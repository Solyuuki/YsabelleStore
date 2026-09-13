import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Expected contract not found: ${label}`);
  }
  return source.replace(from, to);
}

const schemaPath = "database/prisma/schema.prisma";
let schema = fs.readFileSync(schemaPath, "utf8");
schema = replaceOnce(
  schema,
  '  unitCost           Decimal              @map("unit_cost") @db.Decimal(10, 2)',
  '  unitCost           Decimal?             @map("unit_cost") @db.Decimal(10, 2)',
  "nullable InventoryBatch.unitCost"
);
fs.writeFileSync(schemaPath, schema);

const servicePath = "backend/src/services/stockDomainService.ts";
let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  "  unitCost: Prisma.Decimal;\n};",
  "  unitCost: Prisma.Decimal | null;\n};",
  "nullable batch allocation cost"
);

const blockerPattern = /function requireProductCostPrice\(product: \{ costPrice: Prisma\.Decimal \| null; id: string \}\) \{[\s\S]*?\n\}\n\n/;
if (!blockerPattern.test(service)) {
  throw new Error("Hard procurement-cost blocker function not found");
}
service = service.replace(blockerPattern, "");

const replacements = [
  [
    "const unitCost = input.unitCost ?? requireProductCostPrice(product);",
    "const unitCost = input.unitCost ?? product.costPrice ?? null;",
    "stock-in cost fallback"
  ],
  [
    "const adjustmentUnitCost = requireProductCostPrice(product);",
    "const adjustmentUnitCost = product.costPrice ?? null;",
    "adjustment-in cost fallback"
  ],
  [
    "const reconciliationUnitCost = existingBatch ? undefined : requireProductCostPrice(product);",
    "const reconciliationUnitCost = existingBatch ? undefined : (product.costPrice ?? null);",
    "reconciliation cost fallback"
  ],
  [
    "unitCost: reconciliationUnitCost ?? requireProductCostPrice(product)",
    "unitCost: reconciliationUnitCost ?? product.costPrice ?? null",
    "reconciliation batch cost"
  ]
];
for (const [from, to, label] of replacements) {
  service = replaceOnce(service, from, to, label);
}

const auditAnchor = `      ...(batches.some(\n        (batch) => batch.status === InventoryBatchStatus.REMOVED && batch.quantityRemaining > 0\n      )\n        ? ["REMOVED_BATCH_HAS_QUANTITY"]\n        : []),\n`;
service = replaceOnce(
  service,
  auditAnchor,
  `${auditAnchor}      ...(batches.some((batch) => batch.unitCost === null) ? ["UNKNOWN_BATCH_COST"] : []),\n`,
  "unknown-cost audit signal"
);

if (service.includes("PRODUCT_COST_PRICE_REQUIRED") || service.includes("requireProductCostPrice")) {
  throw new Error("Procurement-cost hard blocker still exists after patch");
}
fs.writeFileSync(servicePath, service);

const migrationDir = "database/prisma/migrations/20260913133000_allow_unknown_inventory_batch_cost";
fs.mkdirSync(migrationDir, { recursive: true });
fs.writeFileSync(
  path.join(migrationDir, "migration.sql"),
  "-- Physical stock truth must not be blocked by missing procurement metadata.\n" +
    "-- NULL means the batch cost is not yet verified; never substitute a fake zero cost.\n" +
    "ALTER TABLE `inventory_batches` MODIFY `unit_cost` DECIMAL(10, 2) NULL;\n"
);

console.log("Central stock-cost blocker removal staged successfully.");
