import fs from "node:fs";

const schemaPath = "database/prisma/schema.prisma";
let schema = fs.readFileSync(schemaPath, "utf8");

const accountNeedle = `  phoneNormalized String?               @unique(map: "uq_customer_accounts_phone_normalized") @map("phone_normalized") @db.VarChar(16)
  passwordHash    String?               @map("password_hash") @db.VarChar(255)`;
const accountReplacement = `  phoneNormalized String?               @unique(map: "uq_customer_accounts_phone_normalized") @map("phone_normalized") @db.VarChar(16)
  emailVerifiedAt DateTime?             @map("email_verified_at")
  phoneVerifiedAt DateTime?             @map("phone_verified_at")
  passwordHash    String?               @map("password_hash") @db.VarChar(255)`;
if (!schema.includes(accountNeedle)) throw new Error("CustomerAccount insertion point not found");
schema = schema.replace(accountNeedle, accountReplacement);

const modelNeedle = "model CustomerSocialIdentity {";
if (!schema.includes(modelNeedle)) throw new Error("Email challenge insertion point not found");
const emailModels = `model CustomerEmailRegistrationChallenge {
  id                     String    @id @db.VarChar(191)
  registrationIntentHash String    @map("registration_intent_hash") @db.VarChar(64)
  emailNormalized        String    @map("email_normalized") @db.VarChar(191)
  otpHash                String    @map("otp_hash") @db.VarChar(64)
  expiresAt              DateTime  @map("expires_at")
  consumedAt             DateTime? @map("consumed_at")
  failedAttempts         Int       @default(0) @map("failed_attempts") @db.UnsignedInt
  createdAt              DateTime  @default(now()) @map("created_at")

  @@index([registrationIntentHash, createdAt], map: "idx_customer_email_registration_intent_created")
  @@index([emailNormalized, createdAt], map: "idx_customer_email_registration_email_created")
  @@index([expiresAt], map: "idx_customer_email_registration_expires")
  @@index([consumedAt], map: "idx_customer_email_registration_consumed")
  @@map("customer_email_registration_challenges")
}

model CustomerEmailAuthChallenge {
  id                String    @id @default(cuid()) @db.VarChar(191)
  customerAccountId String?   @map("customer_account_id") @db.VarChar(191)
  emailNormalized   String    @map("email_normalized") @db.VarChar(191)
  otpHash           String    @map("otp_hash") @db.VarChar(64)
  expiresAt         DateTime  @map("expires_at")
  consumedAt        DateTime? @map("consumed_at")
  failedAttempts    Int       @default(0) @map("failed_attempts") @db.UnsignedInt
  createdAt         DateTime  @default(now()) @map("created_at")

  @@index([emailNormalized, createdAt], map: "idx_customer_email_auth_email_created")
  @@index([customerAccountId], map: "idx_customer_email_auth_customer")
  @@index([expiresAt], map: "idx_customer_email_auth_expires")
  @@index([consumedAt], map: "idx_customer_email_auth_consumed")
  @@map("customer_email_auth_challenges")
}

`;
schema = schema.replace(modelNeedle, emailModels + modelNeedle);
fs.writeFileSync(schemaPath, schema);

const migrationDir = "database/prisma/migrations/20260831170000_customer_verified_identity_quick_sign";
fs.mkdirSync(migrationDir, { recursive: true });
fs.writeFileSync(
  `${migrationDir}/migration.sql`,
  `ALTER TABLE customer_accounts
  ADD COLUMN email_verified_at DATETIME(3) NULL,
  ADD COLUMN phone_verified_at DATETIME(3) NULL;

CREATE TABLE customer_email_registration_challenges (
  id VARCHAR(191) NOT NULL,
  registration_intent_hash VARCHAR(64) NOT NULL,
  email_normalized VARCHAR(191) NOT NULL,
  otp_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  failed_attempts INTEGER UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_customer_email_registration_intent_created (registration_intent_hash, created_at),
  INDEX idx_customer_email_registration_email_created (email_normalized, created_at),
  INDEX idx_customer_email_registration_expires (expires_at),
  INDEX idx_customer_email_registration_consumed (consumed_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customer_email_auth_challenges (
  id VARCHAR(191) NOT NULL,
  customer_account_id VARCHAR(191) NULL,
  email_normalized VARCHAR(191) NOT NULL,
  otp_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  failed_attempts INTEGER UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_customer_email_auth_email_created (email_normalized, created_at),
  INDEX idx_customer_email_auth_customer (customer_account_id),
  INDEX idx_customer_email_auth_expires (expires_at),
  INDEX idx_customer_email_auth_consumed (consumed_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`
);
