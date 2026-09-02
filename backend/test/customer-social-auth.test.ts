import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  authenticateCustomerSocialIdentity,
  completeCustomerSocialLink
} from "../src/services/customerSocialAuthService.js";
import { hashPassword } from "../src/services/passwordHashService.js";
import { HttpError } from "../src/utils/httpError.js";

const createdEmails: string[] = [];

function providerIdentity(
  suffix: string,
  overrides: Partial<{
    provider: "GOOGLE" | "FACEBOOK";
    providerSubject: string;
    email: string | null;
    emailVerified: boolean;
    emailAuthoritative: boolean;
    name: string;
  }> = {}
) {
  return {
    provider: "GOOGLE" as const,
    providerSubject: `google-${suffix}`,
    email: `social-${suffix}@example.com`,
    emailVerified: true,
    emailAuthoritative: false,
    name: "Social Customer",
    ...overrides
  };
}

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, code);
    return true;
  };
}

test("first social authentication creates one passwordless customer identity and a normal customer session", async () => {
  const suffix = randomUUID().slice(0, 8);
  const identity = providerIdentity(suffix);
  createdEmails.push(identity.email!);

  const result = await authenticateCustomerSocialIdentity(identity);
  assert.equal(result.kind, "authenticated");
  if (result.kind !== "authenticated") return;

  assert.equal(result.customer.email, identity.email);
  assert.equal(result.customer.username, null);
  assert.ok(result.sessionToken.length >= 32);

  const persisted = await prisma.customerAccount.findUniqueOrThrow({
    where: { email: identity.email! }
  });
  assert.equal(persisted.passwordHash, null);

  const socialIdentity = await prisma.customerSocialIdentity.findUniqueOrThrow({
    where: {
      provider_providerSubject: {
        provider: identity.provider,
        providerSubject: identity.providerSubject
      }
    }
  });
  assert.equal(socialIdentity.customerAccountId, persisted.id);
});

test("returning provider subject signs into the same customer instead of creating a duplicate", async () => {
  const suffix = randomUUID().slice(0, 8);
  const identity = providerIdentity(suffix);
  createdEmails.push(identity.email!);

  const first = await authenticateCustomerSocialIdentity(identity);
  const second = await authenticateCustomerSocialIdentity(identity);
  assert.equal(first.kind, "authenticated");
  assert.equal(second.kind, "authenticated");
  if (first.kind !== "authenticated" || second.kind !== "authenticated") return;

  assert.equal(first.customer.id, second.customer.id);
  assert.equal(await prisma.customerAccount.count({ where: { email: identity.email! } }), 1);
  assert.equal(
    await prisma.customerSocialIdentity.count({
      where: { provider: identity.provider, providerSubject: identity.providerSubject }
    }),
    1
  );
});

test("authoritative Google email match auto-links the existing customer and signs in without password proof", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `existing-google-${suffix}@gmail.com`;
  const providerSubject = `authoritative-${suffix}`;
  createdEmails.push(email);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Existing Google Customer",
      username: `google.${suffix}`,
      email,
      passwordHash: await hashPassword("ExistingPass123!"),
      status: "ACTIVE"
    }
  });

  const result = await authenticateCustomerSocialIdentity(
    providerIdentity(suffix, {
      email,
      providerSubject,
      emailAuthoritative: true
    })
  );

  assert.equal(result.kind, "authenticated");
  if (result.kind !== "authenticated") return;
  assert.equal(result.customer.id, customer.id);
  assert.equal(result.customer.email, email);
  assert.ok(result.sessionToken.length >= 32);
  assert.equal(await prisma.customerAccount.count({ where: { email } }), 1);
  assert.equal(
    await prisma.customerSocialIdentity.count({
      where: { provider: "GOOGLE", providerSubject }
    }),
    1
  );
  assert.equal(
    await prisma.customerSocialLinkIntent.count({
      where: { customerAccountId: customer.id, provider: "GOOGLE", usedAt: null }
    }),
    0
  );
});

test("non-authoritative existing customer email requires ownership proof and never creates a duplicate", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `existing-social-${suffix}@example.com`;
  createdEmails.push(email);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Existing Customer",
      username: `existing.${suffix}`,
      email,
      passwordHash: await hashPassword("ExistingPass123!"),
      status: "ACTIVE"
    }
  });

  const result = await authenticateCustomerSocialIdentity(
    providerIdentity(suffix, { email, providerSubject: `collision-${suffix}` })
  );
  assert.equal(result.kind, "link_required");
  if (result.kind !== "link_required") return;

  assert.ok(result.linkIntentToken.length >= 32);
  assert.equal(await prisma.customerAccount.count({ where: { email } }), 1);
  assert.equal(
    await prisma.customerSocialIdentity.count({
      where: { provider: "GOOGLE", providerSubject: `collision-${suffix}` }
    }),
    0
  );

  await assert.rejects(
    completeCustomerSocialLink({
      linkIntentToken: result.linkIntentToken,
      authenticatedCustomerId: `${customer.id}-wrong`
    }),
    expectCode("SOCIAL_AUTH_LINK_CONFLICT")
  );

  await completeCustomerSocialLink({
    linkIntentToken: result.linkIntentToken,
    authenticatedCustomerId: customer.id
  });
  assert.equal(
    await prisma.customerSocialIdentity.count({
      where: { provider: "GOOGLE", providerSubject: `collision-${suffix}` }
    }),
    1
  );
});

test("unverified Google email, missing email, and inactive linked customers fail closed", async () => {
  const suffix = randomUUID().slice(0, 8);

  await assert.rejects(
    authenticateCustomerSocialIdentity(
      providerIdentity(`${suffix}-unverified`, { emailVerified: false })
    ),
    expectCode("SOCIAL_AUTH_EMAIL_REQUIRED")
  );
  await assert.rejects(
    authenticateCustomerSocialIdentity(
      providerIdentity(`${suffix}-missing`, { email: null, emailVerified: false })
    ),
    expectCode("SOCIAL_AUTH_EMAIL_REQUIRED")
  );

  const activeIdentity = providerIdentity(`${suffix}-inactive`);
  createdEmails.push(activeIdentity.email!);
  const signedIn = await authenticateCustomerSocialIdentity(activeIdentity);
  assert.equal(signedIn.kind, "authenticated");
  if (signedIn.kind !== "authenticated") return;
  await prisma.customerAccount.update({
    where: { id: signedIn.customer.id },
    data: { status: "INACTIVE" }
  });

  await assert.rejects(
    authenticateCustomerSocialIdentity(activeIdentity),
    expectCode("SOCIAL_AUTH_ACCOUNT_UNAVAILABLE")
  );
});

test("simultaneous first login for one provider identity converges to one customer and one identity", async () => {
  const suffix = randomUUID().slice(0, 8);
  const identity = providerIdentity(`${suffix}-race`);
  createdEmails.push(identity.email!);

  const results = await Promise.all([
    authenticateCustomerSocialIdentity(identity),
    authenticateCustomerSocialIdentity(identity)
  ]);
  assert.equal(
    results.every((result) => result.kind === "authenticated"),
    true
  );
  const ids = results.flatMap((result) =>
    result.kind === "authenticated" ? [result.customer.id] : []
  );
  assert.equal(new Set(ids).size, 1);
  assert.equal(await prisma.customerAccount.count({ where: { email: identity.email! } }), 1);
  assert.equal(
    await prisma.customerSocialIdentity.count({
      where: { provider: identity.provider, providerSubject: identity.providerSubject }
    }),
    1
  );
});

test.after(async () => {
  const customers = await prisma.customerAccount.findMany({
    where: { email: { in: createdEmails } },
    select: { id: true }
  });
  const customerIds = customers.map((customer) => customer.id);
  if (customerIds.length > 0) {
    await prisma.customerSocialLinkIntent.deleteMany({
      where: { customerAccountId: { in: customerIds } }
    });
    await prisma.customerSocialIdentity.deleteMany({
      where: { customerAccountId: { in: customerIds } }
    });
    await prisma.customerSession.deleteMany({ where: { customerAccountId: { in: customerIds } } });
    await prisma.customerPasswordResetToken.deleteMany({
      where: { customerAccountId: { in: customerIds } }
    });
    await prisma.customerAccount.deleteMany({ where: { id: { in: customerIds } } });
  }
});
