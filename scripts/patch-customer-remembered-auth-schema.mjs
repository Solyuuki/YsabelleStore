import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const schemaPath = "database/prisma/schema.prisma";
let schema = readFileSync(schemaPath, "utf8");

if (!schema.includes("enum CustomerRememberedAuthMethod")) {
  schema = schema.replace(
    `enum CustomerOAuthTransport {\n  WEB\n  ELECTRON\n}\n`,
    `enum CustomerOAuthTransport {\n  WEB\n  ELECTRON\n}\n\nenum CustomerRememberedAuthMethod {\n  EMAIL\n  MOBILE\n}\n`
  );
}

if (!schema.includes("rememberedAuth       CustomerRememberedAuth[]")) {
  schema = schema.replace(
    "  orders              CustomerOrder[]\n",
    "  orders              CustomerOrder[]\n  rememberedAuth       CustomerRememberedAuth[]\n"
  );
}

if (!schema.includes("model CustomerRememberedAuth {")) {
  const model = `model CustomerRememberedAuth {\n  id                String                       @id @default(cuid()) @db.VarChar(191)\n  browserTokenHash  String                       @map(\"browser_token_hash\") @db.VarChar(64)\n  customerAccountId String                       @map(\"customer_account_id\") @db.VarChar(191)\n  authMethod        CustomerRememberedAuthMethod @map(\"auth_method\")\n  trustedUntil      DateTime                     @map(\"trusted_until\")\n  lastUsedAt        DateTime?                    @map(\"last_used_at\")\n  createdAt         DateTime                     @default(now()) @map(\"created_at\")\n  updatedAt         DateTime                     @updatedAt @map(\"updated_at\")\n  customerAccount   CustomerAccount              @relation(fields: [customerAccountId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n\n  @@unique([browserTokenHash, customerAccountId], map: \"uq_customer_remembered_auth_browser_customer\")\n  @@index([browserTokenHash], map: \"idx_customer_remembered_auth_browser\")\n  @@index([customerAccountId], map: \"idx_customer_remembered_auth_customer\")\n  @@index([trustedUntil], map: \"idx_customer_remembered_auth_trusted_until\")\n  @@map(\"customer_remembered_auth\")\n}\n\n`;
  schema = schema.replace("model CustomerMobileAuthChallenge {", `${model}model CustomerMobileAuthChallenge {`);
}

writeFileSync(schemaPath, schema);

const migrationDir = "database/prisma/migrations/20260831190000_customer_remembered_quick_sign";
mkdirSync(migrationDir, { recursive: true });
writeFileSync(
  `${migrationDir}/migration.sql`,
  `CREATE TABLE \`customer_remembered_auth\` (\n  \`id\` VARCHAR(191) NOT NULL,\n  \`browser_token_hash\` VARCHAR(64) NOT NULL,\n  \`customer_account_id\` VARCHAR(191) NOT NULL,\n  \`auth_method\` ENUM('EMAIL', 'MOBILE') NOT NULL,\n  \`trusted_until\` DATETIME(3) NOT NULL,\n  \`last_used_at\` DATETIME(3) NULL,\n  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n  \`updated_at\` DATETIME(3) NOT NULL,\n\n  UNIQUE INDEX \`uq_customer_remembered_auth_browser_customer\`(\`browser_token_hash\`, \`customer_account_id\`),\n  INDEX \`idx_customer_remembered_auth_browser\`(\`browser_token_hash\`),\n  INDEX \`idx_customer_remembered_auth_customer\`(\`customer_account_id\`),\n  INDEX \`idx_customer_remembered_auth_trusted_until\`(\`trusted_until\`),\n  PRIMARY KEY (\`id\`)\n) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n\nALTER TABLE \`customer_remembered_auth\`\n  ADD CONSTRAINT \`customer_remembered_auth_customer_account_id_fkey\`\n  FOREIGN KEY (\`customer_account_id\`) REFERENCES \`customer_accounts\`(\`id\`)\n  ON DELETE CASCADE ON UPDATE CASCADE;\n`
);

rmSync("scripts/patch-customer-remembered-auth-schema.mjs");
rmSync(".github/workflows/patch-customer-remembered-auth-schema.yml");
