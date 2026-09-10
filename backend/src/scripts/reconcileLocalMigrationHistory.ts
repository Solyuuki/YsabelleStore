import { spawnSync } from "node:child_process";

import { prisma } from "../database/prismaClient.js";

const TARGET_MIGRATIONS = [
  "20260827040000_customer_password_recovery",
  "20260829071000_customer_social_auth",
  "20260831170000_customer_verified_identity_quick_sign",
  "20260831190000_customer_remembered_quick_sign"
] as const;

type TargetMigration = (typeof TARGET_MIGRATIONS)[number];
type CountRow = { count: bigint | number };
type ColumnRow = {
  columnName: string;
  dataType: string;
  isNullable: "YES" | "NO";
  characterMaximumLength: bigint | number | null;
};
type IndexRow = { indexName: string; nonUnique: bigint | number };
type ForeignKeyRow = {
  constraintName: string;
  referencedTableName: string;
  deleteRule: string;
  updateRule: string;
};

type CheckResult = {
  migration: TargetMigration;
  ok: boolean;
  failures: string[];
};

function count(rows: CountRow[]) {
  return Number(rows[0]?.count ?? 0);
}

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
  `;
  return count(rows) === 1;
}

async function column(tableName: string, columnName: string) {
  const rows = await prisma.$queryRaw<ColumnRow[]>`
    SELECT
      column_name AS columnName,
      data_type AS dataType,
      is_nullable AS isNullable,
      character_maximum_length AS characterMaximumLength
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
      AND column_name = ${columnName}
  `;
  return rows[0] ?? null;
}

async function index(tableName: string, indexName: string) {
  const rows = await prisma.$queryRaw<IndexRow[]>`
    SELECT DISTINCT index_name AS indexName, non_unique AS nonUnique
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
      AND index_name = ${indexName}
  `;
  return rows[0] ?? null;
}

async function foreignKey(tableName: string, columnName: string) {
  const rows = await prisma.$queryRaw<ForeignKeyRow[]>`
    SELECT
      kcu.constraint_name AS constraintName,
      kcu.referenced_table_name AS referencedTableName,
      rc.delete_rule AS deleteRule,
      rc.update_rule AS updateRule
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = kcu.constraint_schema
     AND rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_schema = DATABASE()
      AND kcu.table_name = ${tableName}
      AND kcu.column_name = ${columnName}
      AND kcu.referenced_table_name IS NOT NULL
  `;
  return rows[0] ?? null;
}

async function requireTable(failures: string[], tableName: string) {
  if (!(await tableExists(tableName))) failures.push(`Missing table ${tableName}.`);
}

async function requireColumn(
  failures: string[],
  tableName: string,
  columnName: string,
  options: { nullable?: boolean; varcharLength?: number } = {}
) {
  const value = await column(tableName, columnName);
  if (!value) {
    failures.push(`Missing column ${tableName}.${columnName}.`);
    return;
  }
  if (options.nullable !== undefined) {
    const nullable = value.isNullable === "YES";
    if (nullable !== options.nullable) {
      failures.push(
        `${tableName}.${columnName} nullable=${nullable}; expected ${options.nullable}.`
      );
    }
  }
  if (options.varcharLength !== undefined) {
    const length = Number(value.characterMaximumLength ?? 0);
    if (value.dataType !== "varchar" || length !== options.varcharLength) {
      failures.push(
        `${tableName}.${columnName} is ${value.dataType}(${length}); expected varchar(${options.varcharLength}).`
      );
    }
  }
}

async function requireIndex(
  failures: string[],
  tableName: string,
  indexName: string,
  unique?: boolean
) {
  const value = await index(tableName, indexName);
  if (!value) {
    failures.push(`Missing index ${tableName}.${indexName}.`);
    return;
  }
  if (unique !== undefined && (Number(value.nonUnique) === 0) !== unique) {
    failures.push(`${tableName}.${indexName} uniqueness does not match the migration.`);
  }
}

async function requireCustomerForeignKey(failures: string[], tableName: string) {
  const value = await foreignKey(tableName, "customer_account_id");
  if (!value) {
    failures.push(`Missing foreign key ${tableName}.customer_account_id -> customer_accounts.id.`);
    return;
  }
  if (
    value.referencedTableName !== "customer_accounts" ||
    value.deleteRule !== "CASCADE" ||
    value.updateRule !== "CASCADE"
  ) {
    failures.push(
      `${tableName}.customer_account_id foreign key does not match CASCADE/CASCADE customer_accounts.`
    );
  }
}

async function verifyPasswordRecovery(): Promise<CheckResult> {
  const failures: string[] = [];
  const migration = TARGET_MIGRATIONS[0];
  await requireTable(failures, "customer_password_reset_tokens");
  await requireColumn(failures, "customer_password_reset_tokens", "id", {
    nullable: false,
    varcharLength: 191
  });
  await requireColumn(failures, "customer_password_reset_tokens", "customer_account_id", {
    nullable: false,
    varcharLength: 191
  });
  await requireColumn(failures, "customer_password_reset_tokens", "token_hash", {
    nullable: false,
    varcharLength: 64
  });
  await requireColumn(failures, "customer_password_reset_tokens", "expires_at", { nullable: false });
  await requireColumn(failures, "customer_password_reset_tokens", "used_at", { nullable: true });
  await requireIndex(
    failures,
    "customer_password_reset_tokens",
    "uq_customer_password_reset_tokens_token_hash",
    true
  );
  await requireIndex(
    failures,
    "customer_password_reset_tokens",
    "idx_customer_password_reset_tokens_customer"
  );
  await requireIndex(
    failures,
    "customer_password_reset_tokens",
    "idx_customer_password_reset_tokens_expires"
  );
  await requireIndex(
    failures,
    "customer_password_reset_tokens",
    "idx_customer_password_reset_tokens_used"
  );
  await requireCustomerForeignKey(failures, "customer_password_reset_tokens");
  return { migration, ok: failures.length === 0, failures };
}

async function verifySocialAuth(): Promise<CheckResult> {
  const failures: string[] = [];
  const migration = TARGET_MIGRATIONS[1];
  await requireColumn(failures, "customer_accounts", "password_hash", {
    nullable: true,
    varcharLength: 255
  });

  for (const tableName of [
    "customer_social_identities",
    "customer_social_link_intents",
    "customer_oauth_transactions",
    "customer_oauth_handoffs"
  ]) {
    await requireTable(failures, tableName);
  }

  await requireIndex(
    failures,
    "customer_social_identities",
    "uq_customer_social_identities_provider_subject",
    true
  );
  await requireIndex(
    failures,
    "customer_social_identities",
    "uq_customer_social_identities_customer_provider",
    true
  );
  await requireIndex(
    failures,
    "customer_social_link_intents",
    "uq_customer_social_link_intents_token_hash",
    true
  );
  await requireIndex(
    failures,
    "customer_oauth_transactions",
    "uq_customer_oauth_transactions_state_hash",
    true
  );
  await requireIndex(
    failures,
    "customer_oauth_handoffs",
    "uq_customer_oauth_handoffs_code_hash",
    true
  );
  await requireCustomerForeignKey(failures, "customer_social_identities");
  await requireCustomerForeignKey(failures, "customer_social_link_intents");
  await requireCustomerForeignKey(failures, "customer_oauth_handoffs");
  return { migration, ok: failures.length === 0, failures };
}

async function verifyVerifiedIdentity(): Promise<CheckResult> {
  const failures: string[] = [];
  const migration = TARGET_MIGRATIONS[2];
  await requireColumn(failures, "customer_accounts", "email_verified_at", { nullable: true });
  await requireColumn(failures, "customer_accounts", "phone_verified_at", { nullable: true });
  await requireTable(failures, "customer_email_registration_challenges");
  await requireTable(failures, "customer_email_auth_challenges");
  await requireIndex(
    failures,
    "customer_email_registration_challenges",
    "idx_customer_email_registration_intent_created"
  );
  await requireIndex(
    failures,
    "customer_email_registration_challenges",
    "idx_customer_email_registration_email_created"
  );
  await requireIndex(
    failures,
    "customer_email_auth_challenges",
    "idx_customer_email_auth_email_created"
  );
  await requireIndex(
    failures,
    "customer_email_auth_challenges",
    "idx_customer_email_auth_customer"
  );
  return { migration, ok: failures.length === 0, failures };
}

async function verifyRememberedAuth(): Promise<CheckResult> {
  const failures: string[] = [];
  const migration = TARGET_MIGRATIONS[3];
  await requireTable(failures, "customer_remembered_auth");
  await requireColumn(failures, "customer_remembered_auth", "browser_token_hash", {
    nullable: false,
    varcharLength: 64
  });
  await requireColumn(failures, "customer_remembered_auth", "customer_account_id", {
    nullable: false,
    varcharLength: 191
  });
  await requireIndex(
    failures,
    "customer_remembered_auth",
    "uq_customer_remembered_auth_browser_customer",
    true
  );
  await requireIndex(failures, "customer_remembered_auth", "idx_customer_remembered_auth_browser");
  await requireIndex(failures, "customer_remembered_auth", "idx_customer_remembered_auth_customer");
  await requireIndex(
    failures,
    "customer_remembered_auth",
    "idx_customer_remembered_auth_trusted_until"
  );
  await requireCustomerForeignKey(failures, "customer_remembered_auth");
  return { migration, ok: failures.length === 0, failures };
}

function resolveApplied(migration: TargetMigration) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    executable,
    [
      "prisma",
      "migrate",
      "resolve",
      "--applied",
      migration,
      "--schema",
      "database/prisma/schema.prisma"
    ],
    { encoding: "utf8", stdio: "pipe" }
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Unable to mark ${migration} as applied (exit ${result.status ?? "unknown"}).`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const checks = await Promise.all([
    verifyPasswordRecovery(),
    verifySocialAuth(),
    verifyVerifiedIdentity(),
    verifyRememberedAuth()
  ]);

  for (const check of checks) {
    console.info(`${check.ok ? "PASS" : "BLOCK"} ${check.migration}`);
    for (const failure of check.failures) console.error(`  - ${failure}`);
  }

  if (checks.some((check) => !check.ok)) {
    console.error("MIGRATION_HISTORY_RECONCILIATION=BLOCKED");
    console.error(
      "The live schema does not prove equivalence to every pending historical migration. No migration history was changed."
    );
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.info("MIGRATION_HISTORY_RECONCILIATION=READY_TO_BASELINE");
    console.info(
      "All four historical migration contracts already exist in the live schema. Re-run with --apply to repair Prisma migration history only."
    );
    return;
  }

  for (const migration of TARGET_MIGRATIONS) {
    console.info(`Marking verified historical migration as applied: ${migration}`);
    resolveApplied(migration);
  }

  console.info("MIGRATION_HISTORY_RECONCILIATION=APPLIED");
  console.info(
    "Only Prisma migration history was reconciled; application tables and business data were not modified by this script."
  );
}

main()
  .catch((error) => {
    console.error("MIGRATION_HISTORY_RECONCILIATION=ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
