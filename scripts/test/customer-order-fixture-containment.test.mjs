import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { fixtureCategoryEvidence } from "../lib/catalog-quality.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const customerOrderTest = fs.readFileSync(
  path.join(REPO_ROOT, "backend", "test", "customer-order-account.test.ts"),
  "utf8"
);
const fixtureScope = fs.readFileSync(
  path.join(REPO_ROOT, "backend", "test", "helpers", "databaseFixtureScope.ts"),
  "utf8"
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
);
const cleanupPath = path.join(REPO_ROOT, "scripts", "customer-order-fixture-cleanup.mjs");
const cleanupScript = fs.existsSync(cleanupPath) ? fs.readFileSync(cleanupPath, "utf8") : "";

test("catalog quality recognizes leaked customer-order fixture categories exactly", () => {
  assert.deepEqual(fixtureCategoryEvidence({ name: "Customer Order Test deadbeef" }), [
    "CUSTOMER_ORDER_TEST"
  ]);
  assert.deepEqual(fixtureCategoryEvidence({ name: "Customer Order Test 0110af20" }), [
    "CUSTOMER_ORDER_TEST"
  ]);
  assert.deepEqual(fixtureCategoryEvidence({ name: "Customer Order Test Specials" }), []);
  assert.deepEqual(fixtureCategoryEvidence({ name: "Customer Orders" }), []);
});

test("customer-order fixture setup registers cleanup before storefront rows can leak", () => {
  assert.match(customerOrderTest, /captureDatabaseFixtureScope/);
  assert.match(
    customerOrderTest,
    /async function createFixture\(\)[\s\S]*?const scope = await captureDatabaseFixtureScope\(prisma\);[\s\S]*?try\s*\{/
  );
  assert.match(
    customerOrderTest,
    /catch \(error\)\s*\{[\s\S]*?await scope\.cleanup\(\);[\s\S]*?throw error;/
  );
  assert.match(customerOrderTest, /return \{[\s\S]*?scope[\s\S]*?\};/);
  assert.match(
    customerOrderTest,
    /async function cleanupFixture[\s\S]*?await fixture\.scope\.cleanup\(\);/
  );
});

test("database fixture scope covers customer accounts and sessions", () => {
  assert.match(fixtureScope, /customerAccounts: string\[\]/);
  assert.match(fixtureScope, /customerSessions: string\[\]/);
  assert.match(fixtureScope, /prisma\.customerAccount\.findMany/);
  assert.match(fixtureScope, /prisma\.customerSession\.findMany/);
  assert.match(fixtureScope, /transaction\.customerSession\.deleteMany/);
  assert.match(fixtureScope, /transaction\.customerAccount\.deleteMany/);
});

test("repository exposes a dry-run and explicit apply command for leaked customer-order fixtures", () => {
  assert.equal(typeof packageJson.scripts["customer-order-fixtures:clean"], "string");
  assert.equal(typeof packageJson.scripts["customer-order-fixtures:clean:apply"], "string");
  assert.match(packageJson.scripts["customer-order-fixtures:clean"], /customer-order-fixture-cleanup\.mjs/);
  assert.match(packageJson.scripts["customer-order-fixtures:clean:apply"], /--apply/);
  assert.match(cleanupScript, /Customer Order Test/);
  assert.match(cleanupScript, /Customer Order Product/);
  assert.match(cleanupScript, /CUSTOMER-ORDER-/);
  assert.match(cleanupScript, /process\.argv\.includes\("--apply"\)/);
  assert.match(cleanupScript, /Refusing to purge/);
});
