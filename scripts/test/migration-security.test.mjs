import assert from "node:assert/strict";
import test from "node:test";
import { inspectGeneration2, sha256 } from "../migration-security.mjs";
const schema = `model Example { id Int @id @@map("examples") }
model ProductReview { id Int @id rating Int @@map("product_reviews") }
model CustomerSavedAddress { id Int @id @@map("customer_saved_addresses") }`;
const baseline = `CREATE TABLE \`examples\` (\`id\` INTEGER NOT NULL, PRIMARY KEY (\`id\`));
CREATE TABLE \`product_reviews\` (\`id\` INTEGER NOT NULL, \`rating\` TINYINT UNSIGNED NOT NULL, CONSTRAINT \`chk_product_reviews_rating\` CHECK (\`rating\` BETWEEN 1 AND 5), PRIMARY KEY (\`id\`));
CREATE TABLE \`customer_saved_addresses\` (\`id\` INTEGER NOT NULL, \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (\`id\`));`;
const run = (sql = baseline, checksum = sha256(baseline)) =>
  inspectGeneration2({
    schema,
    active: new Map([["0000_generation2_baseline", sql]]),
    archiveNames: new Set(["0001_legacy"]),
    state: { migrationEpoch: 2, baselineMigration: "0000_generation2_baseline" },
    checksums: { migrations: { "0000_generation2_baseline": checksum } }
  });
test("Generation 2 complete frozen baseline passes", () => assert.deepEqual(run(), []));
test("frozen mutation is blocked", () =>
  assert.ok(
    run(baseline + "\n-- changed", sha256(baseline)).some((x) => x.includes("checksum changed"))
  ));
test("legacy migration cannot re-enter active lineage", () => {
  const f = inspectGeneration2({
    schema,
    active: new Map([["0001_legacy", baseline]]),
    archiveNames: new Set(["0001_legacy"]),
    state: { migrationEpoch: 2, baselineMigration: "0000_generation2_baseline" },
    checksums: { migrations: { "0001_legacy": sha256(baseline) } }
  });
  assert.ok(f.some((x) => x.includes("legacy migration")));
});
test("raw SQL contracts are enforced", () => {
  const broken = baseline
    .replace("CONSTRAINT \`chk_product_reviews_rating\` CHECK (\`rating\` BETWEEN 1 AND 5),", "")
    .replace(" ON UPDATE CURRENT_TIMESTAMP(3)", "");
  const f = run(broken, sha256(broken));
  assert.ok(f.some((x) => x.includes("rating CHECK")));
  assert.ok(f.some((x) => x.includes("ON UPDATE")));
});
