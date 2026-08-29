import { readFile, writeFile } from "node:fs/promises";

const patches = [
  {
    path: "backend/test/customer-account-security.test.ts",
    before: `      const customer = await prisma.customerAccount.findUniqueOrThrow({ where: { email } });\n      assert.equal(await verifyPassword(NEW_PASSWORD, customer.passwordHash), true);`,
    after: `      const customer = await prisma.customerAccount.findUniqueOrThrow({ where: { email } });\n      assert.ok(customer.passwordHash);\n      assert.equal(await verifyPassword(NEW_PASSWORD, customer.passwordHash), true);`
  },
  {
    path: "backend/test/customer-auth-password-security.test.ts",
    before: `  const persisted = await prisma.customerAccount.findUniqueOrThrow({ where: { id: customer.id } });\n  assert.equal(passwordHashNeedsUpgrade(persisted.passwordHash), false);`,
    after: `  const persisted = await prisma.customerAccount.findUniqueOrThrow({ where: { id: customer.id } });\n  assert.ok(persisted.passwordHash);\n  assert.equal(passwordHashNeedsUpgrade(persisted.passwordHash), false);`
  },
  {
    path: "backend/test/customer-auth.test.ts",
    before: `  assert.equal(persisted.phoneNormalized, normalizedPhone);\n  assert.ok(persisted.passwordHash.startsWith("scrypt$"));`,
    after: `  assert.equal(persisted.phoneNormalized, normalizedPhone);\n  assert.ok(persisted.passwordHash);\n  assert.ok(persisted.passwordHash.startsWith("scrypt$"));`
  }
];

for (const patch of patches) {
  const original = await readFile(patch.path, "utf8");
  if (original.includes(patch.after)) continue;
  if (!original.includes(patch.before)) {
    throw new Error(`Expected nullable-password test pattern was not found in ${patch.path}`);
  }
  await writeFile(patch.path, original.replace(patch.before, patch.after), "utf8");
}
