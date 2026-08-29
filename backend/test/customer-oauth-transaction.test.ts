import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  consumeCustomerOAuthTransaction,
  createCustomerOAuthTransaction,
  createCustomerOAuthHandoff,
  redeemCustomerOAuthHandoff
} from "../src/services/customerOAuthTransactionService.js";
import { HttpError } from "../src/utils/httpError.js";

function challenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, code);
    return true;
  };
}

test("web oauth transaction stores only hashed/encrypted security material and is single-use", async () => {
  const now = new Date("2026-08-29T07:20:00.000Z");
  const transaction = await createCustomerOAuthTransaction(
    {
      provider: "GOOGLE",
      transport: "WEB",
      returnPath: "/account"
    },
    now
  );

  assert.ok(transaction.state.length >= 32);
  assert.ok(transaction.browserBinding.length >= 32);
  assert.ok(transaction.pkceChallenge.length >= 43);
  assert.ok(transaction.nonce && transaction.nonce.length >= 32);
  assert.equal(transaction.expiresAt.getTime(), now.getTime() + 10 * 60 * 1000);

  const persisted = await prisma.customerOAuthTransaction.findUniqueOrThrow({
    where: { id: transaction.transactionId }
  });
  assert.equal(persisted.stateHash.length, 64);
  assert.notEqual(persisted.stateHash, transaction.state);
  assert.notEqual(persisted.browserBindingHash, transaction.browserBinding);
  assert.equal(persisted.pkceVerifierCiphertext.includes(transaction.pkceVerifier), false);
  assert.equal(persisted.nonceCiphertext?.includes(transaction.nonce!), false);

  const consumed = await consumeCustomerOAuthTransaction(
    {
      provider: "GOOGLE",
      transport: "WEB",
      state: transaction.state,
      browserBinding: transaction.browserBinding
    },
    new Date(now.getTime() + 1_000)
  );
  assert.equal(consumed.pkceVerifier, transaction.pkceVerifier);
  assert.equal(consumed.nonce, transaction.nonce);
  assert.equal(consumed.returnPath, "/account");

  await assert.rejects(
    consumeCustomerOAuthTransaction({
      provider: "GOOGLE",
      transport: "WEB",
      state: transaction.state,
      browserBinding: transaction.browserBinding
    }),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );
});

test("oauth transaction rejects wrong browser binding, provider mismatch, and expiry", async () => {
  const now = new Date("2026-08-29T07:30:00.000Z");
  const transaction = await createCustomerOAuthTransaction(
    { provider: "FACEBOOK", transport: "WEB" },
    now
  );

  await assert.rejects(
    consumeCustomerOAuthTransaction(
      {
        provider: "FACEBOOK",
        transport: "WEB",
        state: transaction.state,
        browserBinding: "wrong-browser-binding"
      },
      new Date(now.getTime() + 500)
    ),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );

  await assert.rejects(
    consumeCustomerOAuthTransaction(
      {
        provider: "GOOGLE",
        transport: "WEB",
        state: transaction.state,
        browserBinding: transaction.browserBinding
      },
      new Date(now.getTime() + 500)
    ),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );

  await assert.rejects(
    consumeCustomerOAuthTransaction(
      {
        provider: "FACEBOOK",
        transport: "WEB",
        state: transaction.state,
        browserBinding: transaction.browserBinding
      },
      new Date(now.getTime() + 10 * 60 * 1000 + 1)
    ),
    expectCode("SOCIAL_AUTH_INVALID_CALLBACK")
  );
});

test("electron handoff requires the private verifier, expires after 90 seconds, and cannot be replayed", async () => {
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Electron OAuth Customer",
      email: `electron-oauth-${randomBytes(8).toString("hex")}@example.com`,
      passwordHash: null,
      status: "ACTIVE"
    }
  });
  const verifier = randomBytes(32).toString("base64url");
  const now = new Date("2026-08-29T07:40:00.000Z");

  try {
    const handoff = await createCustomerOAuthHandoff(customer.id, challenge(verifier), now);
    assert.equal(handoff.expiresAt.getTime(), now.getTime() + 90_000);

    const persisted = await prisma.customerOAuthHandoff.findUniqueOrThrow({
      where: { codeHash: createHash("sha256").update(handoff.code).digest("hex") }
    });
    assert.notEqual(persisted.codeHash, handoff.code);

    await assert.rejects(
      redeemCustomerOAuthHandoff(
        { code: handoff.code, verifier: "incorrect-verifier" },
        new Date(now.getTime() + 1_000)
      ),
      expectCode("SOCIAL_AUTH_HANDOFF_INVALID")
    );

    const redeemedCustomerId = await redeemCustomerOAuthHandoff(
      { code: handoff.code, verifier },
      new Date(now.getTime() + 2_000)
    );
    assert.equal(redeemedCustomerId, customer.id);

    await assert.rejects(
      redeemCustomerOAuthHandoff({ code: handoff.code, verifier }),
      expectCode("SOCIAL_AUTH_HANDOFF_INVALID")
    );

    const expired = await createCustomerOAuthHandoff(customer.id, challenge(verifier), now);
    await assert.rejects(
      redeemCustomerOAuthHandoff(
        { code: expired.code, verifier },
        new Date(now.getTime() + 90_001)
      ),
      expectCode("SOCIAL_AUTH_HANDOFF_INVALID")
    );
  } finally {
    await prisma.customerOAuthHandoff.deleteMany({ where: { customerAccountId: customer.id } });
    await prisma.customerAccount.delete({ where: { id: customer.id } });
  }
});

test.after(async () => {
  await prisma.customerOAuthTransaction.deleteMany({});
});
