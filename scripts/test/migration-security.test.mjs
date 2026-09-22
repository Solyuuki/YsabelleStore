import assert from "node:assert/strict";
import test from "node:test";

import { gitBlobOid, inspectGeneration2, sha256 } from "../migration-security.mjs";

const schema = `
model Example {
  id Int @id

  @@map("examples")
}

model ProductReview {
  id Int @id
  rating Int

  @@map("product_reviews")
}

model CustomerSavedAddress {
  id Int @id

  @@map("customer_saved_addresses")
}
`;

const baseline = `CREATE TABLE \`examples\` (\`id\` INTEGER NOT NULL, PRIMARY KEY (\`id\`));
CREATE TABLE \`product_reviews\` (\`id\` INTEGER NOT NULL, \`rating\` TINYINT UNSIGNED NOT NULL, CONSTRAINT \`chk_product_reviews_rating\` CHECK (\`rating\` BETWEEN 1 AND 5), PRIMARY KEY (\`id\`));
CREATE TABLE \`customer_saved_addresses\` (\`id\` INTEGER NOT NULL, \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (\`id\`));`;

const legacySql = "CREATE TABLE `legacy_only` (`id` INTEGER NOT NULL);";

function baseOptions(sql = baseline, checksum = sha256(baseline)) {
  return {
    schema,
    active: new Map([["0000_generation2_baseline", sql]]),
    archiveNames: new Set(["0001_legacy"]),
    archive: new Map([["0001_legacy", legacySql]]),
    state: { migrationEpoch: 2, baselineMigration: "0000_generation2_baseline" },
    checksums: {
      formatVersion: 1,
      algorithm: "sha256",
      migrationEpoch: 2,
      migrations: { "0000_generation2_baseline": checksum }
    },
    legacyBlobs: {
      formatVersion: 1,
      algorithm: "git-blob-sha1",
      migrations: [
        {
          name: "0001_legacy",
          gitBlobOid: gitBlobOid(legacySql),
          size: Buffer.byteLength(legacySql, "utf8")
        }
      ]
    },
    migrationLock: 'provider = "mysql"'
  };
}

const run = (sql = baseline, checksum = sha256(baseline)) =>
  inspectGeneration2(baseOptions(sql, checksum));

test("Generation 2 complete frozen baseline passes", () => assert.deepEqual(run(), []));

test("frozen mutation is blocked", () =>
  assert.ok(
    run(baseline + "\n-- changed", sha256(baseline)).some((x) => x.includes("checksum changed"))
  ));

test("legacy migration cannot re-enter active lineage", () => {
  const options = baseOptions();
  options.active = new Map([["0001_legacy", baseline]]);
  options.checksums.migrations = { "0001_legacy": sha256(baseline) };
  const findings = inspectGeneration2(options);
  assert.ok(findings.some((x) => x.includes("legacy migration")));
});

test("raw SQL contracts are enforced", () => {
  const broken = baseline
    .replace("CONSTRAINT `chk_product_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5),", "")
    .replace(" ON UPDATE CURRENT_TIMESTAMP(3)", "");
  const findings = run(broken, sha256(broken));
  assert.ok(findings.some((x) => x.includes("rating CHECK")));
  assert.ok(findings.some((x) => x.includes("ON UPDATE")));
});

test("legacy archive content is fingerprint frozen", () => {
  const options = baseOptions();
  options.archive.set("0001_legacy", legacySql + "\n-- mutated");
  const findings = inspectGeneration2(options);
  assert.ok(findings.some((x) => x.includes("archived migration changed")));
});

test("migration lock must stay on MySQL", () => {
  const options = baseOptions();
  options.migrationLock = 'provider = "postgresql"';
  const findings = inspectGeneration2(options);
  assert.ok(findings.some((x) => x.includes("must pin the active lineage to MySQL")));
});

test("destructive forward migration is blocked", () => {
  const options = baseOptions();
  const destructive = "ALTER TABLE `examples` DROP COLUMN `legacy_value`;";
  options.active.set("0001_drop_legacy_value", destructive);
  options.checksums.migrations["0001_drop_legacy_value"] = sha256(destructive);
  const findings = inspectGeneration2(options);
  assert.ok(findings.some((x) => x.includes("destructive SQL")));
});
