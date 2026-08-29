import assert from "node:assert/strict";
import {
  createSign,
  generateKeyPairSync,
  type KeyObject
} from "node:crypto";
import test from "node:test";

import {
  createFacebookCustomerOAuthProvider,
  createGoogleCustomerOAuthProvider
} from "../src/services/customerOAuthProviderService.js";
import { HttpError } from "../src/utils/httpError.js";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signGoogleIdToken(
  privateKey: KeyObject,
  input: {
    clientId: string;
    nonce: string;
    subject?: string;
    email?: string;
    emailVerified?: boolean;
    issuer?: string;
    expiresAtSeconds?: number;
  }
) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const payload = encode({
    iss: input.issuer ?? "https://accounts.google.com",
    aud: input.clientId,
    sub: input.subject ?? "google-subject-123",
    email: input.email ?? "google@example.com",
    email_verified: input.emailVerified ?? true,
    name: "Google Customer",
    nonce: input.nonce,
    iat: now - 5,
    exp: input.expiresAtSeconds ?? now + 300
  });
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey).toString("base64url")}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, code);
    return true;
  };
}

test("Google provider builds PKCE authorization URL and validates signed ID-token audience, issuer, nonce and verified email", async () => {
  const clientId = "google-client.apps.googleusercontent.com";
  const clientSecret = "google-secret";
  const nonce = "nonce-value-12345678901234567890123456789012";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: "jwk" });
  const idToken = signGoogleIdToken(privateKey, { clientId, nonce });
  const calls: string[] = [];
  const provider = createGoogleCustomerOAuthProvider({
    clientId,
    clientSecret,
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://oauth2.googleapis.com/token") {
        assert.equal(init?.method, "POST");
        const body = String(init?.body);
        assert.match(body, /grant_type=authorization_code/);
        assert.match(body, /code_verifier=pkce-verifier/);
        return jsonResponse({ id_token: idToken, access_token: "temporary-google-access-token" });
      }
      if (url === "https://www.googleapis.com/oauth2/v3/certs") {
        return jsonResponse({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] });
      }
      throw new Error(`Unexpected Google URL: ${url}`);
    }
  });

  const authorizationUrl = provider.buildAuthorizationUrl({
    redirectUri: "https://api.example.com/api/customer-auth/social/google/callback",
    state: "state-123",
    pkceChallenge: "challenge-123",
    nonce
  });
  assert.equal(authorizationUrl.origin, "https://accounts.google.com");
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizationUrl.searchParams.get("scope"), "openid email profile");
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorizationUrl.searchParams.get("nonce"), nonce);

  const identity = await provider.exchangeCodeForIdentity({
    code: "provider-code",
    redirectUri: "https://api.example.com/api/customer-auth/social/google/callback",
    pkceVerifier: "pkce-verifier",
    nonce
  });
  assert.deepEqual(identity, {
    provider: "GOOGLE",
    providerSubject: "google-subject-123",
    email: "google@example.com",
    emailVerified: true,
    name: "Google Customer"
  });
  assert.deepEqual(calls, [
    "https://oauth2.googleapis.com/token",
    "https://www.googleapis.com/oauth2/v3/certs"
  ]);
});

test("Google provider rejects nonce mismatch, wrong audience and unverified email", async () => {
  const clientId = "expected-client.apps.googleusercontent.com";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: "jwk" });

  async function run(token: string, nonce: string) {
    const provider = createGoogleCustomerOAuthProvider({
      clientId,
      clientSecret: "secret",
      fetchImpl: async (input) =>
        String(input).includes("/token")
          ? jsonResponse({ id_token: token })
          : jsonResponse({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] })
    });
    return provider.exchangeCodeForIdentity({
      code: "code",
      redirectUri: "https://api.example.com/callback",
      pkceVerifier: "verifier",
      nonce
    });
  }

  await assert.rejects(
    run(signGoogleIdToken(privateKey, { clientId, nonce: "actual-nonce" }), "wrong-nonce"),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );
  await assert.rejects(
    run(
      signGoogleIdToken(privateKey, { clientId: "different-client", nonce: "nonce" }),
      "nonce"
    ),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );
  await assert.rejects(
    run(signGoogleIdToken(privateKey, { clientId, nonce: "nonce", emailVerified: false }), "nonce"),
    expectCode("SOCIAL_AUTH_EMAIL_REQUIRED")
  );
});

test("Facebook provider validates token app identity before reading minimal profile fields", async () => {
  const calls: string[] = [];
  const provider = createFacebookCustomerOAuthProvider({
    appId: "facebook-app-id",
    appSecret: "facebook-app-secret",
    graphApiVersion: "v26.0",
    fetchImpl: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/oauth/access_token")) {
        return jsonResponse({ access_token: "temporary-facebook-access-token" });
      }
      if (url.includes("/debug_token")) {
        return jsonResponse({
          data: {
            is_valid: true,
            app_id: "facebook-app-id",
            user_id: "facebook-user-123"
          }
        });
      }
      if (url.includes("/me?")) {
        return jsonResponse({
          id: "facebook-user-123",
          name: "Facebook Customer",
          email: "facebook@example.com"
        });
      }
      throw new Error(`Unexpected Facebook URL: ${url}`);
    }
  });

  const authorizationUrl = provider.buildAuthorizationUrl({
    redirectUri: "https://api.example.com/api/customer-auth/social/facebook/callback",
    state: "state-123",
    pkceChallenge: "challenge-123",
    nonce: null
  });
  assert.equal(authorizationUrl.hostname, "www.facebook.com");
  assert.equal(authorizationUrl.searchParams.get("scope"), "public_profile,email");
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");

  const identity = await provider.exchangeCodeForIdentity({
    code: "facebook-code",
    redirectUri: "https://api.example.com/api/customer-auth/social/facebook/callback",
    pkceVerifier: "facebook-verifier",
    nonce: null
  });
  assert.deepEqual(identity, {
    provider: "FACEBOOK",
    providerSubject: "facebook-user-123",
    email: "facebook@example.com",
    emailVerified: true,
    name: "Facebook Customer"
  });
  assert.equal(calls.length, 3);
});

test("Facebook provider rejects invalid app identity and missing email", async () => {
  const invalidAppProvider = createFacebookCustomerOAuthProvider({
    appId: "facebook-app-id",
    appSecret: "facebook-app-secret",
    graphApiVersion: "v26.0",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("/oauth/access_token")) return jsonResponse({ access_token: "access" });
      if (url.includes("/debug_token")) {
        return jsonResponse({ data: { is_valid: true, app_id: "other-app", user_id: "user" } });
      }
      return jsonResponse({ id: "user", name: "User", email: "user@example.com" });
    }
  });
  await assert.rejects(
    invalidAppProvider.exchangeCodeForIdentity({
      code: "code",
      redirectUri: "https://api.example.com/callback",
      pkceVerifier: "verifier",
      nonce: null
    }),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );

  const missingEmailProvider = createFacebookCustomerOAuthProvider({
    appId: "facebook-app-id",
    appSecret: "facebook-app-secret",
    graphApiVersion: "v26.0",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("/oauth/access_token")) return jsonResponse({ access_token: "access" });
      if (url.includes("/debug_token")) {
        return jsonResponse({ data: { is_valid: true, app_id: "facebook-app-id", user_id: "user" } });
      }
      return jsonResponse({ id: "user", name: "User" });
    }
  });
  await assert.rejects(
    missingEmailProvider.exchangeCodeForIdentity({
      code: "code",
      redirectUri: "https://api.example.com/callback",
      pkceVerifier: "verifier",
      nonce: null
    }),
    expectCode("SOCIAL_AUTH_EMAIL_REQUIRED")
  );
});
