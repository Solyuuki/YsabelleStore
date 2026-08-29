import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  completeCustomerElectronOAuth,
  redeemCustomerElectronOAuth,
  startCustomerElectronOAuth
} from "../src/services/customerOAuthService.js";
import type { CustomerOAuthProvider } from "../src/services/customerOAuthProviderService.js";
import { HttpError } from "../src/utils/httpError.js";

const emails: string[] = [];

function s256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function fakeGoogleProvider(email: string, subject: string): CustomerOAuthProvider {
  return {
    buildAuthorizationUrl(input) {
      const url = new URL("https://provider.example/google");
      url.searchParams.set("state", input.state);
      url.searchParams.set("challenge", input.pkceChallenge);
      return url;
    },
    async exchangeCodeForIdentity(input) {
      assert.equal(input.code, "provider-code");
      return {
        provider: "GOOGLE",
        providerSubject: subject,
        email,
        emailVerified: true,
        name: "Electron Customer"
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

test("Electron social OAuth keeps its private verifier out of the browser and produces a one-use customer session handoff", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `electron-flow-${suffix}@example.com`;
  emails.push(email);
  const verifier = randomBytes(32).toString("base64url");
  const provider = fakeGoogleProvider(email, `google-electron-${suffix}`);

  const start = await startCustomerElectronOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/electron/callback",
      verifierChallenge: s256(verifier)
    },
    provider
  );
  assert.equal(start.authorizationUrl.toString().includes(verifier), false);
  const state = start.authorizationUrl.searchParams.get("state")!;

  const callback = await completeCustomerElectronOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/electron/callback",
      state,
      code: "provider-code"
    },
    provider
  );
  assert.equal(callback.kind, "authenticated");
  if (callback.kind !== "authenticated") return;
  assert.ok(callback.handoffCode.length >= 32);
  assert.equal("sessionToken" in callback, false);

  const redeemed = await redeemCustomerElectronOAuth({
    code: callback.handoffCode,
    verifier
  });
  assert.equal(redeemed.customer.id, callback.customer.id);
  assert.ok(redeemed.sessionToken.length >= 32);

  await assert.rejects(
    redeemCustomerElectronOAuth({ code: callback.handoffCode, verifier }),
    expectCode("SOCIAL_AUTH_HANDOFF_INVALID")
  );
});

test("Electron matching-email collision remains link-required and creates no duplicate customer", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `electron-link-${suffix}@example.com`;
  emails.push(email);
  await prisma.customerAccount.create({
    data: {
      name: "Existing Electron Customer",
      username: `electron.${suffix}`,
      email,
      passwordHash: "existing-password-hash-not-used-here",
      status: "ACTIVE"
    }
  });
  const verifier = randomBytes(32).toString("base64url");
  const provider = fakeGoogleProvider(email, `google-electron-link-${suffix}`);
  const start = await startCustomerElectronOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/electron/callback",
      verifierChallenge: s256(verifier)
    },
    provider
  );

  const callback = await completeCustomerElectronOAuth(
    {
      provider: "GOOGLE",
      redirectUri: "https://api.example.com/api/customer-auth/social/google/electron/callback",
      state: start.authorizationUrl.searchParams.get("state")!,
      code: "provider-code"
    },
    provider
  );
  assert.equal(callback.kind, "link_required");
  assert.equal(await prisma.customerAccount.count({ where: { email } }), 1);
});

test.after(async () => {
  const customers = await prisma.customerAccount.findMany({
    where: { email: { in: emails } },
    select: { id: true }
  });
  const ids = customers.map((customer) => customer.id);
  if (ids.length) {
    await prisma.customerOAuthHandoff.deleteMany({ where: { customerAccountId: { in: ids } } });
    await prisma.customerSocialLinkIntent.deleteMany({ where: { customerAccountId: { in: ids } } });
    await prisma.customerSocialIdentity.deleteMany({ where: { customerAccountId: { in: ids } } });
    await prisma.customerSession.deleteMany({ where: { customerAccountId: { in: ids } } });
    await prisma.customerPasswordResetToken.deleteMany({ where: { customerAccountId: { in: ids } } });
    await prisma.customerAccount.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.customerOAuthTransaction.deleteMany({});
});
