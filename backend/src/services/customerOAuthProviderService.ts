import { createPublicKey, verify as verifySignature } from "node:crypto";

import type { CustomerSocialProvider } from "@prisma/client";

import { env } from "../config/env.js";
import { normalizeCustomerEmail } from "../utils/customerIdentity.js";
import { HttpError } from "../utils/httpError.js";
import type { CustomerSocialIdentityInput } from "./customerSocialAuthService.js";

type FetchLike = typeof fetch;

type OAuthAuthorizationInput = {
  redirectUri: string;
  state: string;
  pkceChallenge: string;
  nonce: string | null;
};

type OAuthExchangeInput = {
  code: string;
  redirectUri: string;
  pkceVerifier: string;
  nonce: string | null;
};

export type CustomerOAuthProvider = {
  buildAuthorizationUrl(input: OAuthAuthorizationInput): URL;
  exchangeCodeForIdentity(input: OAuthExchangeInput): Promise<CustomerSocialIdentityInput>;
};

type GoogleProviderConfig = {
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchLike;
};

type FacebookProviderConfig = {
  appId: string;
  appSecret: string;
  graphApiVersion: string;
  fetchImpl?: FetchLike;
};

type GoogleJwtHeader = {
  alg?: unknown;
  kid?: unknown;
};

type GoogleJwtPayload = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
  name?: unknown;
  nonce?: unknown;
  exp?: unknown;
  iat?: unknown;
};

type JsonWebKeyWithMetadata = Record<string, unknown> & {
  kid?: string;
  alg?: string;
  use?: string;
};

function providerError(
  code: string,
  message = "Customer social authentication could not be completed."
): HttpError {
  return new HttpError(400, message, { code });
}

function providerUnavailable(): HttpError {
  return new HttpError(503, "Social sign-in is temporarily unavailable.", {
    code: "SOCIAL_AUTH_PROVIDER_UNAVAILABLE",
    expose: true
  });
}

function invalidCallback(): HttpError {
  return providerError("SOCIAL_AUTH_INVALID_CALLBACK");
}

function emailRequired(): HttpError {
  return providerError("SOCIAL_AUTH_EMAIL_REQUIRED", "A verified provider email is required.");
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw invalidCallback();
  try {
    return await response.json();
  } catch {
    throw invalidCallback();
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidCallback();
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeJsonSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    throw invalidCallback();
  }
}

function parseGoogleJwt(token: string) {
  const [headerSegment, payloadSegment, signatureSegment, ...extra] = token.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment || extra.length > 0) {
    throw invalidCallback();
  }

  return {
    headerSegment,
    payloadSegment,
    signatureSegment,
    header: decodeJsonSegment<GoogleJwtHeader>(headerSegment),
    payload: decodeJsonSegment<GoogleJwtPayload>(payloadSegment)
  };
}

function audienceMatches(audience: unknown, clientId: string): boolean {
  if (typeof audience === "string") return audience === clientId;
  if (Array.isArray(audience)) {
    return audience.length === 1 && audience[0] === clientId;
  }
  return false;
}

function isAuthoritativeGoogleEmail(email: string, hostedDomain: string | null): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === "gmail.com" || Boolean(hostedDomain);
}

async function validateGoogleIdToken(input: {
  token: string;
  expectedClientId: string;
  expectedNonce: string;
  fetchImpl: FetchLike;
}): Promise<CustomerSocialIdentityInput> {
  const parsed = parseGoogleJwt(input.token);
  const kid = stringValue(parsed.header.kid);
  if (parsed.header.alg !== "RS256" || !kid) throw invalidCallback();

  const jwksResponse = await input.fetchImpl("https://www.googleapis.com/oauth2/v3/certs", {
    headers: { accept: "application/json" }
  });
  const jwks = objectValue(await readJson(jwksResponse));
  if (!Array.isArray(jwks.keys)) throw invalidCallback();

  const jwk = (jwks.keys as unknown[])
    .filter((candidate): candidate is JsonWebKeyWithMetadata =>
      Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate))
    )
    .find(
      (candidate) => candidate.kid === kid && candidate.alg === "RS256" && candidate.use === "sig"
    );
  if (!jwk) throw invalidCallback();

  let publicKey;
  try {
    const publicKeyInput = { key: jwk, format: "jwk" } as Parameters<typeof createPublicKey>[0];
    publicKey = createPublicKey(publicKeyInput);
  } catch {
    throw invalidCallback();
  }

  const signature = Buffer.from(parsed.signatureSegment, "base64url");
  const signingInput = Buffer.from(`${parsed.headerSegment}.${parsed.payloadSegment}`, "utf8");
  if (!verifySignature("RSA-SHA256", signingInput, publicKey, signature)) throw invalidCallback();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuer = stringValue(parsed.payload.iss);
  const subject = stringValue(parsed.payload.sub);
  const nonce = stringValue(parsed.payload.nonce);
  const expiration = typeof parsed.payload.exp === "number" ? parsed.payload.exp : NaN;
  const issuedAt = typeof parsed.payload.iat === "number" ? parsed.payload.iat : NaN;

  if (
    (issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") ||
    !audienceMatches(parsed.payload.aud, input.expectedClientId) ||
    !subject ||
    nonce !== input.expectedNonce ||
    !Number.isFinite(expiration) ||
    expiration <= nowSeconds ||
    !Number.isFinite(issuedAt) ||
    issuedAt > nowSeconds + 60
  ) {
    throw invalidCallback();
  }

  const email = stringValue(parsed.payload.email);
  const normalizedEmail = email ? normalizeCustomerEmail(email) : null;
  if (!normalizedEmail || parsed.payload.email_verified !== true) throw emailRequired();

  const hostedDomain = stringValue(parsed.payload.hd);
  return {
    provider: "GOOGLE",
    providerSubject: subject,
    email: normalizedEmail,
    emailVerified: true,
    emailAuthoritative: isAuthoritativeGoogleEmail(normalizedEmail, hostedDomain),
    name: stringValue(parsed.payload.name) ?? normalizedEmail.split("@")[0]!
  };
}

export function createGoogleCustomerOAuthProvider(
  config: GoogleProviderConfig
): CustomerOAuthProvider {
  const clientId = config.clientId.trim();
  const clientSecret = config.clientSecret.trim();
  const fetchImpl = config.fetchImpl ?? fetch;
  if (!clientId || !clientSecret) throw providerUnavailable();

  return {
    buildAuthorizationUrl(input) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", input.state);
      url.searchParams.set("code_challenge", input.pkceChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("prompt", "select_account");
      if (input.nonce) url.searchParams.set("nonce", input.nonce);
      return url;
    },

    async exchangeCodeForIdentity(input) {
      if (!input.code || !input.pkceVerifier || !input.nonce) throw invalidCallback();
      const body = new URLSearchParams({
        code: input.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
        code_verifier: input.pkceVerifier
      });
      const tokenResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body
      });
      const tokenPayload = objectValue(await readJson(tokenResponse));
      const idToken = stringValue(tokenPayload.id_token);
      if (!idToken) throw invalidCallback();

      return validateGoogleIdToken({
        token: idToken,
        expectedClientId: clientId,
        expectedNonce: input.nonce,
        fetchImpl
      });
    }
  };
}

export function createFacebookCustomerOAuthProvider(
  config: FacebookProviderConfig
): CustomerOAuthProvider {
  const appId = config.appId.trim();
  const appSecret = config.appSecret.trim();
  const version = config.graphApiVersion.trim();
  const fetchImpl = config.fetchImpl ?? fetch;
  if (!appId || !appSecret || !/^v\d+\.\d+$/.test(version)) throw providerUnavailable();

  return {
    buildAuthorizationUrl(input) {
      const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "public_profile,email");
      url.searchParams.set("state", input.state);
      url.searchParams.set("code_challenge", input.pkceChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url;
    },

    async exchangeCodeForIdentity(input) {
      if (!input.code || !input.pkceVerifier) throw invalidCallback();
      const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
      tokenUrl.searchParams.set("code", input.code);
      tokenUrl.searchParams.set("code_verifier", input.pkceVerifier);
      const tokenPayload = objectValue(await readJson(await fetchImpl(tokenUrl)));
      const accessToken = stringValue(tokenPayload.access_token);
      if (!accessToken) throw invalidCallback();

      const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
      debugUrl.searchParams.set("input_token", accessToken);
      debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);
      const debugPayload = objectValue(await readJson(await fetchImpl(debugUrl)));
      const debugData = objectValue(debugPayload.data);
      const debugUserId = stringValue(debugData.user_id);
      if (debugData.is_valid !== true || stringValue(debugData.app_id) !== appId || !debugUserId) {
        throw invalidCallback();
      }

      const profileUrl = new URL(`https://graph.facebook.com/${version}/me`);
      profileUrl.searchParams.set("fields", "id,name,email");
      profileUrl.searchParams.set("access_token", accessToken);
      const profile = objectValue(await readJson(await fetchImpl(profileUrl)));
      const providerSubject = stringValue(profile.id);
      if (!providerSubject || providerSubject !== debugUserId) throw invalidCallback();

      const email = stringValue(profile.email);
      const normalizedEmail = email ? normalizeCustomerEmail(email) : null;
      if (!normalizedEmail) throw emailRequired();

      return {
        provider: "FACEBOOK",
        providerSubject,
        email: normalizedEmail,
        emailVerified: true,
        emailAuthoritative: false,
        name: stringValue(profile.name) ?? normalizedEmail.split("@")[0]!
      };
    }
  };
}

export function getConfiguredCustomerOAuthProvider(
  provider: CustomerSocialProvider
): CustomerOAuthProvider {
  if (provider === "GOOGLE") {
    if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) throw providerUnavailable();
    return createGoogleCustomerOAuthProvider({
      clientId: env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET
    });
  }

  if (!env.FACEBOOK_OAUTH_APP_ID || !env.FACEBOOK_OAUTH_APP_SECRET) throw providerUnavailable();
  return createFacebookCustomerOAuthProvider({
    appId: env.FACEBOOK_OAUTH_APP_ID,
    appSecret: env.FACEBOOK_OAUTH_APP_SECRET,
    graphApiVersion: env.FACEBOOK_GRAPH_API_VERSION
  });
}
