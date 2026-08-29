import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  completeCustomerWebOAuth,
  startCustomerWebOAuth
} from "../src/services/customerOAuthService.js";
import type { CustomerOAuthProvider } from "../src/services/customerOAuthProviderService.js";
import { HttpError } from "../src/utils/httpError.js";

const createdEmails: string[] = [];

function fakeProvider(input: {
  provider: "GOOGLE" | "FACEBOOK";
  email: string;
  subject: string;
}): CustomerOAuthProvider {
  return {
    buildAuthorizationUrl(authInput) {
      const url = new URL(`https://provider.example/${input.provider.toLowerCase()}`);
      url.searchParams.set("redirect_uri", authInput.redirectUri);
      url.searchParams.set("state", authInput.state);
      url.searchParams.set("challenge", authInput.pkceChallenge);
      if (authInput.nonce) url.searchParams.set("nonce", authInput.nonce);
      return url;
    },
    async exchangeCodeForIdentity(exchangeInput) {
      assert.equal(exchangeInput.code, "provider-code");
      assert.ok(exchangeInput.pkceVerifier.length >= 43);
      if (input.provider === "GOOGLE") assert.ok(exchangeInput.nonce);
      return {
        provider: input.provider,
        providerSubject: input.subject,
        email: input.email,
        emailVerified: true,
        name: "OAuth Customer"
      };
    }
  };
}

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, code);
    return true;
  };
}

test("web oauth start creates a bounded transaction and provider authorization URL without exposing transaction secrets", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `oauth-start-${suffix}@example.com`;
  const provider = fakeProvider({ provider: "GOOGLE", email, subject: `google-${suffix}` });
  const now = new Date("2026-08-29T08:00:00.000Z");

  const start = await startCustomerWebOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/callback",
      returnPath: "/login"
    },
    provider,
    now
  );

  assert.equal(start.authorizationUrl.origin, "https://provider.example");
  assert.equal(start.authorizationUrl.searchParams.get("redirect_uri"), "https://api.example.com/api/customer-auth/social/google/callback");
  assert.ok(start.authorizationUrl.searchParams.get("state"));
  assert.ok(start.browserBinding.length >= 32);
  assert.equal(start.expiresAt.getTime(), now.getTime() + 10 * 60 * 1000);
  assert.equal(start.authorizationUrl.toString().includes(start.browserBinding), false);
});

test("web oauth callback authenticates the provider identity through the existing customer session and rejects replay", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `oauth-complete-${suffix}@example.com`;
  createdEmails.push(email);
  const provider = fakeProvider({ provider: "GOOGLE", email, subject: `google-${suffix}` });

  const start = await startCustomerWebOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/callback",
      returnPath: "/"
    },
    provider
  );
  const state = start.authorizationUrl.searchParams.get("state")!;

  const result = await completeCustomerWebOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/callback",
      state,
      browserBinding: start.browserBinding,
      code: "provider-code"
    },
    provider
  );

  assert.equal(result.kind, "authenticated");
  if (result.kind !== "authenticated") return;
  assert.equal(result.customer.email, email);
  assert.ok(result.sessionToken.length >= 32);
  assert.equal(result.returnPath, "/");

  await assert.rejects(
    completeCustomerWebOAuth(
      {
        provider: "GOOGLE",
        redirectUri: "https://api.example.com/api/customer-auth/social/google/callback",
        state,
        browserBinding: start.browserBinding,
        code: "provider-code"
      },
      provider
    ),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );
});

test("web oauth callback preserves link-required instead of silently merging an existing email", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `oauth-link-${suffix}@example.com`;
  createdEmails.push(email);
  await prisma.customerAccount.create({
    data: {
      name: "Existing OAuth Customer",
      username: `oauth.${suffix}`,
      email,
      passwordHash: "intentionally-not-used-by-this-flow",
      status: "ACTIVE"
    }
  });
  const provider = fakeProvider({ provider: "FACEBOOK", email, subject: `facebook-${suffix}` });

  const start = await startCustomerWebOAuth(
    {
      provider: "FACEBOOK",
      redirectUri: "https://api.example.com/api/customer-auth/social/facebook/callback",
      returnPath: "/login"
    },
    provider
  );
  const result = await completeCustomerWebOAuth(
    {
      provider: "FACEBOOK",
      redirectUri: "https://api.example.com/api/customer-auth/social/facebook/callback",
      state: start.authorizationUrl.searchParams.get("state")!,
      browserBinding: start.browserBinding,
      code: "provider-code"
    },
    provider
  );

  assert.equal(result.kind, "link_required");
  if (result.kind !== "link_required") return;
  assert.ok(result.linkIntentToken.length >= 32);
  assert.equal(result.returnPath, "/login");
  assert.equal(await prisma.customerAccount.count({ where: { email } }), 1);
});

test.after(async () => {
  const customers = await prisma.customerAccount.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true }
  });
  const customerIds = customers.map((customer) => customer.id);
  if (customerIds.length > 0) {
    await prisma.customerSocialLinkIntent.deleteMany({ where: { customerAccountId: { in: customerIds } } });
    await prisma.customerSocialIdentity.deleteMany({ where: { customerAccountId: { in: customerIds } } });
    await prisma.customerSession.deleteMany({ where: { customerAccountId: { in: customerIds } } });
    await prisma.customerPasswordResetToken.deleteMany({ where: { customerAccountId: { in: customerIds } } });
    await prisma.customerAccount.deleteMany({ where: { id: { in: customerIds } } });
  }
  await prisma.customerOAuthTransaction.deleteMany({});
});
