#!/usr/bin/env node
/**
 * Narrow source-code reconciliation for two already-existing, SQL-created address tables.
 * Only --apply changes schema.prisma. Never reads .env or opens a database connection.
 * The original migration SQL is not altered. This does not baseline migration history.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SAVED = `model CustomerSavedAddress {
  customerAccountId String          @id @map("customer_account_id") @db.VarChar(191)
  addressLine1      String          @map("address_line_1") @db.VarChar(180)
  addressLine2      String?         @map("address_line_2") @db.VarChar(180)
  barangay          String          @db.VarChar(120)
  cityMunicipality  String          @map("city_municipality") @db.VarChar(120)
  provinceRegion    String          @map("province_region") @db.VarChar(120)
  postalCode        String          @map("postal_code") @db.VarChar(20)
  country           String          @default("Philippines") @db.VarChar(80)
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @default(now()) @updatedAt @map("updated_at")
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade, onUpdate: Cascade, map: "fk_customer_saved_addresses_account")

  @@map("customer_saved_addresses")
}`;

const SNAPSHOT = `model CustomerOrderAddressSnapshot {
  orderId          String        @id @map("order_id") @db.VarChar(191)
  addressLine1     String        @map("address_line_1") @db.VarChar(180)
  addressLine2     String?       @map("address_line_2") @db.VarChar(180)
  barangay         String        @db.VarChar(120)
  cityMunicipality String        @map("city_municipality") @db.VarChar(120)
  provinceRegion   String        @map("province_region") @db.VarChar(120)
  postalCode       String        @map("postal_code") @db.VarChar(20)
  country          String        @default("Philippines") @db.VarChar(80)
  createdAt        DateTime      @default(now()) @map("created_at")
  order            CustomerOrder @relation(fields: [orderId], references: [id], onDelete: Cascade, onUpdate: Cascade, map: "fk_customer_order_address_snapshot_order")

  @@map("customer_order_address_snapshots")
}`;

function originalEol(text) { return text.includes('\r\n') ? '\r\n' : '\n'; }

function replaceModelOnce(text, modelName, oldLine, newLine) {
  const re = new RegExp(`(^model ${modelName} \\{\\r?\\n)([\\s\\S]*?)(^\\})`, 'm');
  const match = text.match(re);
  if (!match) throw new Error(`Expected model ${modelName} not found; no changes made.`);
  const body = match[2];
  const lines = body.split(/\r?\n/);
  const indices = lines.flatMap((line, index) => line.trim() === oldLine.trim() ? [index] : []);
  if (indices.length !== 1) throw new Error(`Expected exactly one ${modelName}.${oldLine.trim()} anchor; no changes made.`);
  // This targets only the desired model, so unrelated schema contents stay byte-for-byte unchanged.
  const anchor = lines[indices[0]];
  if (body.includes(newLine.trim())) throw new Error(`${modelName} has partially applied address relation; no changes made.`);
  const eol = originalEol(text);
  const replacement = match[1] + body.replace(anchor, anchor + eol + newLine) + match[3];
  return text.replace(match[0], replacement);
}

export function reconcileAddressModels(original) {
  const hasSaved = /^model CustomerSavedAddress \{/m.test(original);
  const hasSnapshot = /^model CustomerOrderAddressSnapshot \{/m.test(original);
  if (hasSaved || hasSnapshot) {
    if (hasSaved && hasSnapshot &&
        /\bsavedAddress\s+CustomerSavedAddress\?/.test(original) &&
        /\baddressSnapshot\s+CustomerOrderAddressSnapshot\?/.test(original) &&
        original.includes('@@map("customer_saved_addresses")') &&
        original.includes('@@map("customer_order_address_snapshots")')) {
      return { content: original, status: 'ALREADY_APPLIED' };
    }
    throw new Error('Address model state is partial or custom; review manually rather than rewriting.');
  }
  let text = replaceModelOnce(original, 'CustomerAccount',
    'rememberedAuth      CustomerRememberedAuth[]',
    '  savedAddress        CustomerSavedAddress?');
  text = replaceModelOnce(text, 'CustomerOrder',
    'items             CustomerOrderItem[]',
    '  addressSnapshot   CustomerOrderAddressSnapshot?');
  const eol = originalEol(original);
  text = text.replace(/\s*$/, eol + eol) + SAVED.replace(/\n/g, eol) + eol + eol + SNAPSHOT.replace(/\n/g, eol) + eol;
  return { content: text, status: 'NEEDS_APPLY' };
}

export function processSchema(schemaPath, apply = false) {
  const original = readFileSync(schemaPath, 'utf8');
  const result = reconcileAddressModels(original);
  if (apply && result.status === 'NEEDS_APPLY') {
    // Source-only write. No migration SQL, DATABASE_URL, or connection is involved.
    writeFileSync(schemaPath, result.content, 'utf8');
    return 'APPLIED';
  }
  return result.status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    console.error('Usage: node scripts/reconcile-prisma-address-models.mjs [--apply]');
    process.exitCode = 2;
  } else {
    try {
      const schemaPath = join(process.cwd(), 'database', 'prisma', 'schema.prisma');
      console.log(`PRISMA_ADDRESS_MODELS=${processSchema(schemaPath, args[0] === '--apply')}`);
      console.log('DATABASE=UNTOUCHED; MIGRATION_HISTORY=UNTOUCHED');
    } catch (error) {
      console.error(`PRISMA_ADDRESS_MODELS=BLOCKED: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
