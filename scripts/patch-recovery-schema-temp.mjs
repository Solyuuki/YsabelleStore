import { mkdir, readFile, writeFile } from "node:fs/promises";

const schemaPath = "database/prisma/schema.prisma";
const migrationDir = "database/prisma/migrations/20260827040000_customer_password_recovery";
const migrationPath = `${migrationDir}/migration.sql`;

let schema = await readFile(schemaPath, "utf8");

const oldRelations = `  sessions        CustomerSession[]\n  orders          CustomerOrder[]\n\n  @@index([status], map: "idx_customer_accounts_status")`;
const newRelations = `  sessions            CustomerSession[]\n  passwordResetTokens CustomerPasswordResetToken[]\n  orders              CustomerOrder[]\n\n  @@index([status], map: "idx_customer_accounts_status")`;

if (!schema.includes("passwordResetTokens CustomerPasswordResetToken[]")) {
  if (!schema.includes(oldRelations)) throw new Error("CustomerAccount insertion point not found.");
  schema = schema.replace(oldRelations, newRelations);
}

const resetModel = `model CustomerPasswordResetToken {
  id                String          @id @default(cuid()) @db.VarChar(191)
  customerAccountId String          @map("customer_account_id") @db.VarChar(191)
  tokenHash         String          @unique(map: "uq_customer_password_reset_tokens_token_hash") @map("token_hash") @db.VarChar(64)
  expiresAt         DateTime        @map("expires_at")
  usedAt            DateTime?       @map("used_at")
  createdAt         DateTime        @default(now()) @map("created_at")
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([customerAccountId], map: "idx_customer_password_reset_tokens_customer")
  @@index([expiresAt], map: "idx_customer_password_reset_tokens_expires")
  @@index([usedAt], map: "idx_customer_password_reset_tokens_used")
  @@map("customer_password_reset_tokens")
}

`;

if (!schema.includes("model CustomerPasswordResetToken {")) {
  const marker = "model CustomerSession {";
  if (!schema.includes(marker)) throw new Error("CustomerSession insertion point not found.");
  schema = schema.replace(marker, resetModel + marker);
}

await writeFile(schemaPath, schema);
await mkdir(migrationDir, { recursive: true });
await writeFile(
  migrationPath,
  `CREATE TABLE \`customer_password_reset_tokens\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`customer_account_id\` VARCHAR(191) NOT NULL,
  \`token_hash\` VARCHAR(64) NOT NULL,
  \`expires_at\` DATETIME(3) NOT NULL,
  \`used_at\` DATETIME(3) NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX \`uq_customer_password_reset_tokens_token_hash\`(\`token_hash\`),
  INDEX \`idx_customer_password_reset_tokens_customer\`(\`customer_account_id\`),
  INDEX \`idx_customer_password_reset_tokens_expires\`(\`expires_at\`),
  INDEX \`idx_customer_password_reset_tokens_used\`(\`used_at\`),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE \`customer_password_reset_tokens\`
  ADD CONSTRAINT \`customer_password_reset_tokens_customer_account_id_fkey\`
  FOREIGN KEY (\`customer_account_id\`) REFERENCES \`customer_accounts\`(\`id\`)
  ON DELETE CASCADE ON UPDATE CASCADE;
`
);
