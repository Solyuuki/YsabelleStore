import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processSchema, reconcileAddressModels } from '../reconcile-prisma-address-models.mjs';

const FIXTURE = `generator client { provider = "prisma-client-js" }
model CustomerAccount {
  id String @id
  rememberedAuth      CustomerRememberedAuth[]
}
model CustomerOrder {
  id String @id
  items             CustomerOrderItem[]
}
model CustomerRememberedAuth { id String @id }
model CustomerOrderItem { id String @id }
`;

test('adds two exact SQL table models with inverse relations and named cascade FKs', () => {
  const { content, status } = reconcileAddressModels(FIXTURE);
  assert.equal(status, 'NEEDS_APPLY');
  for (const value of [
    'model CustomerSavedAddress {', 'model CustomerOrderAddressSnapshot {',
    'savedAddress        CustomerSavedAddress?', 'addressSnapshot   CustomerOrderAddressSnapshot?',
    '@default("Philippines")', '@default(now()) @updatedAt @map("updated_at")',
    'map: "fk_customer_saved_addresses_account"',
    'map: "fk_customer_order_address_snapshot_order"',
    '@@map("customer_saved_addresses")', '@@map("customer_order_address_snapshots")',
  ]) assert.ok(content.includes(value), `Missing contract: ${value}`);
  assert.deepEqual(reconcileAddressModels(content), { content, status: 'ALREADY_APPLIED' });
});

test('refuses partial models or unexpected anchors, without writing', () => {
  assert.throws(() => reconcileAddressModels(FIXTURE + '\nmodel CustomerSavedAddress { id String @id }\n'), /partial or custom/);
  assert.throws(() => reconcileAddressModels(FIXTURE.replace('rememberedAuth      CustomerRememberedAuth[]', 'unexpected String')), /Expected exactly one/);
});

test('check is read-only; apply modifies only a temporary schema file once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ysabelle-address-source-'));
  const path = join(dir, 'schema.prisma');
  try {
    writeFileSync(path, FIXTURE);
    assert.equal(processSchema(path), 'NEEDS_APPLY');
    assert.equal(readFileSync(path, 'utf8'), FIXTURE);
    assert.equal(processSchema(path, true), 'APPLIED');
    const updated = readFileSync(path, 'utf8');
    assert.equal(processSchema(path, true), 'ALREADY_APPLIED');
    assert.equal(readFileSync(path, 'utf8'), updated);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
