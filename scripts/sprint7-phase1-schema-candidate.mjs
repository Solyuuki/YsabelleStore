import { readFile, writeFile } from "node:fs/promises";

const schemaPath = "database/prisma/schema.prisma";
let schema = await readFile(schemaPath, "utf8");

const userStatusAnchor = `enum UserStatus {
  ACTIVE
  INACTIVE
}
`;
if (!schema.includes("enum CustomerAccountStatus")) {
  if (!schema.includes(userStatusAnchor)) throw new Error("UserStatus anchor not found.");
  schema = schema.replace(
    userStatusAnchor,
    `${userStatusAnchor}
enum CustomerAccountStatus {
  ACTIVE
  INACTIVE
}
`
  );
}

const trustedDeviceAnchor = `  @@map("trusted_devices")
}
`;
if (!schema.includes("model CustomerAccount")) {
  if (!schema.includes(trustedDeviceAnchor)) throw new Error("TrustedDevice anchor not found.");
  schema = schema.replace(
    trustedDeviceAnchor,
    `${trustedDeviceAnchor}
model CustomerAccount {
  id           String                @id @default(cuid()) @db.VarChar(191)
  name         String                @db.VarChar(120)
  email        String                @unique(map: "uq_customer_accounts_email") @db.VarChar(191)
  phone        String?               @db.VarChar(40)
  passwordHash String                @map("password_hash") @db.VarChar(255)
  status       CustomerAccountStatus @default(ACTIVE)
  createdAt    DateTime              @default(now()) @map("created_at")
  updatedAt    DateTime              @updatedAt @map("updated_at")
  sessions     CustomerSession[]
  orders       CustomerOrder[]

  @@index([status], map: "idx_customer_accounts_status")
  @@map("customer_accounts")
}

model CustomerSession {
  id                String          @id @default(cuid()) @db.VarChar(191)
  customerAccountId String          @map("customer_account_id") @db.VarChar(191)
  tokenHash         String          @unique(map: "uq_customer_sessions_token_hash") @map("token_hash") @db.VarChar(64)
  expiresAt         DateTime        @map("expires_at")
  revokedAt         DateTime?       @map("revoked_at")
  lastUsedAt        DateTime?       @map("last_used_at")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([customerAccountId], map: "idx_customer_sessions_customer")
  @@index([expiresAt], map: "idx_customer_sessions_expires")
  @@index([revokedAt], map: "idx_customer_sessions_revoked")
  @@map("customer_sessions")
}
`
  );
}

const orderIdAnchor = `model CustomerOrder {
  id                String                    @id @default(cuid()) @db.VarChar(191)
`;
if (!schema.includes("customerAccountId String?")) {
  if (!schema.includes(orderIdAnchor)) throw new Error("CustomerOrder id anchor not found.");
  schema = schema.replace(
    orderIdAnchor,
    `${orderIdAnchor}  customerAccountId String?                   @map("customer_account_id") @db.VarChar(191)
`
  );
}

const orderItemsAnchor = `  items             CustomerOrderItem[]

  @@index([status, createdAt], map: "idx_customer_orders_status_created")
`;
if (!schema.includes("idx_customer_orders_customer_created")) {
  if (!schema.includes(orderItemsAnchor)) throw new Error("CustomerOrder items anchor not found.");
  schema = schema.replace(
    orderItemsAnchor,
    `  items             CustomerOrderItem[]
  customerAccount   CustomerAccount?          @relation(fields: [customerAccountId], references: [id], onDelete: SetNull, onUpdate: Cascade)

  @@index([customerAccountId, createdAt], map: "idx_customer_orders_customer_created")
  @@index([status, createdAt], map: "idx_customer_orders_status_created")
`
  );
}

await writeFile(schemaPath, schema);
console.log("Sprint 7 customer persistence candidate schema applied in working tree.");
