import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const inventoryServicePath = "backend/src/services/inventoryImportService.ts";
const stockDomainPath = "backend/src/services/stockDomainService.ts";
const contractPath = "backend/test/bulk-delivery-phase10-contract.test.ts";
const schemaPath = "database/prisma/schema.prisma";
const migrationDir = "database/prisma/migrations/20260913143000_allow_unknown_inventory_batch_cost";
const migrationPath = `${migrationDir}/migration.sql`;

function replaceRequired(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) {
    throw new Error(`Could not locate ${label} to patch.`);
  }
  return source.replace(oldText, newText);
}

// Keep the Phase 10 expiry normalization that was already queued in this helper.
let inventorySource = readFileSync(inventoryServicePath, "utf8");
const oldParser = `  const parsed = new Date(\`\${trimmed}T00:00:00\`);\n\n  if (Number.isNaN(parsed.getTime())) {\n    errors.push(\n      buildIssue(\n        rowNumber,\n        "expirationDate",\n        "INVALID_EXPIRATION_DATE",\n        "Expiration date is not valid.",\n        trimmed\n      )\n    );\n    return null;\n  }\n\n  const today = new Date();\n  today.setHours(0, 0, 0, 0);\n\n  if (parsed.getTime() < today.getTime()) {`;
const newParser = `  // Treat supplier expiry values as calendar dates, never local timestamps.\n  // Excel/CSV and PDF must normalize the same YYYY-MM-DD to the same UTC date key.\n  const parsed = new Date(\`\${trimmed}T00:00:00Z\`);\n\n  if (\n    Number.isNaN(parsed.getTime()) ||\n    parsed.toISOString().slice(0, 10) !== trimmed\n  ) {\n    errors.push(\n      buildIssue(\n        rowNumber,\n        "expirationDate",\n        "INVALID_EXPIRATION_DATE",\n        "Expiration date is not valid.",\n        trimmed\n      )\n    );\n    return null;\n  }\n\n  const now = new Date();\n  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());\n\n  if (parsed.getTime() < todayUtc) {`;

if (inventorySource.includes(oldParser)) {
  inventorySource = inventorySource.replace(oldParser, newParser);
  writeFileSync(inventoryServicePath, inventorySource);
  console.log("Normalized spreadsheet expiry parsing to UTC date-only semantics.");
} else if (!inventorySource.includes("T00:00:00Z")) {
  throw new Error("Could not locate the inventory expiration parser to patch.");
}

// Physical stock truth must never be blocked by missing procurement metadata.
let stockSource = readFileSync(stockDomainPath, "utf8");
stockSource = replaceRequired(
  stockSource,
  `type BatchAllocation = {\n  batchId: string;\n  quantity: number;\n  unitCost: Prisma.Decimal;\n};`,
  `type BatchAllocation = {\n  batchId: string;\n  quantity: number;\n  unitCost: Prisma.Decimal | null;\n};`,
  "BatchAllocation nullable unit cost"
);

const oldCostGuard = `function requireProductCostPrice(product: { costPrice: Prisma.Decimal | null; id: string }) {\n  if (product.costPrice) return product.costPrice;\n\n  throw new HttpError(\n    422,\n    "A verified procurement cost is required before stock can be recorded.",\n    {\n      code: "PRODUCT_COST_PRICE_REQUIRED",\n      details: { productId: product.id }\n    }\n  );\n}`;
const newCostResolver = `function resolveStockUnitCost(\n  product: { costPrice: Prisma.Decimal | null },\n  explicitUnitCost?: Prisma.Decimal\n) {\n  // Receiving records physical stock even when procurement metadata is not available yet.\n  // Never invent a zero cost: null explicitly means the batch still needs costing metadata.\n  return explicitUnitCost ?? product.costPrice ?? null;\n}`;
stockSource = replaceRequired(stockSource, oldCostGuard, newCostResolver, "procurement cost hard guard");
stockSource = replaceRequired(
  stockSource,
  `  const unitCost = input.unitCost ?? requireProductCostPrice(product);`,
  `  const unitCost = resolveStockUnitCost(product, input.unitCost);`,
  "stock-in cost resolution"
);
stockSource = replaceRequired(
  stockSource,
  `    const adjustmentUnitCost = requireProductCostPrice(product);`,
  `    const adjustmentUnitCost = resolveStockUnitCost(product);`,
  "stock adjustment cost resolution"
);
stockSource = replaceRequired(
  stockSource,
  `  const reconciliationUnitCost = existingBatch ? undefined : requireProductCostPrice(product);`,
  `  const reconciliationUnitCost = existingBatch ? undefined : resolveStockUnitCost(product);`,
  "reconciliation cost resolution"
);
stockSource = replaceRequired(
  stockSource,
  `        unitCost: reconciliationUnitCost ?? requireProductCostPrice(product)`,
  `        unitCost: reconciliationUnitCost ?? resolveStockUnitCost(product)`,
  "reconciliation batch nullable cost"
);

if (stockSource.includes("PRODUCT_COST_PRICE_REQUIRED") || stockSource.includes("requireProductCostPrice")) {
  throw new Error("Procurement cost hard blocker still exists in stockDomainService.ts.");
}
writeFileSync(stockDomainPath, stockSource);
console.log("Removed the shared procurement-cost hard blocker from physical stock flows.");

// A missing procurement cost is represented honestly as NULL at the batch level.
let schemaSource = readFileSync(schemaPath, "utf8");
schemaSource = replaceRequired(
  schemaSource,
  `  unitCost           Decimal              @map("unit_cost") @db.Decimal(10, 2)`,
  `  unitCost           Decimal?             @map("unit_cost") @db.Decimal(10, 2)`,
  "InventoryBatch.unitCost nullability"
);
writeFileSync(schemaPath, schemaSource);

mkdirSync(migrationDir, { recursive: true });
writeFileSync(
  migrationPath,
  `-- Physical stock receipts must not be rejected only because procurement cost is unknown.\n-- NULL means costing metadata is unresolved; it must never be replaced with a fake 0.00.\nALTER TABLE \`inventory_batches\`\n  MODIFY \`unit_cost\` DECIMAL(10, 2) NULL;\n`
);
console.log("Added nullable inventory batch cost migration.");

// Keep regression coverage close to the Phase 10 bulk receiving contract.
let contractSource = readFileSync(contractPath, "utf8");
const routeDeclaration = `const routeSource = readFileSync(resolve(process.cwd(), "src/routes/inventory.routes.ts"), "utf8");\n`;
const extraDeclarations = `const inventoryImportSource = readFileSync(\n  resolve(process.cwd(), "src/services/inventoryImportService.ts"),\n  "utf8"\n);\nconst stockDomainSource = readFileSync(\n  resolve(process.cwd(), "src/services/stockDomainService.ts"),\n  "utf8"\n);\nconst productImportSource = readFileSync(\n  resolve(process.cwd(), "src/services/productImportService.ts"),\n  "utf8"\n);\nconst prismaSchemaSource = readFileSync(\n  resolve(process.cwd(), "../database/prisma/schema.prisma"),\n  "utf8"\n);\nconst nullableCostMigrationSource = readFileSync(\n  resolve(\n    process.cwd(),\n    "../database/prisma/migrations/20260913143000_allow_unknown_inventory_batch_cost/migration.sql"\n  ),\n  "utf8"\n);\n`;

if (!contractSource.includes("const stockDomainSource = readFileSync(")) {
  if (!contractSource.includes(routeDeclaration)) {
    throw new Error("Could not locate Phase 10 contract declaration anchor.");
  }
  const declarationsToAdd = contractSource.includes("const inventoryImportSource = readFileSync(")
    ? extraDeclarations.slice(extraDeclarations.indexOf("const stockDomainSource"))
    : extraDeclarations;
  contractSource = contractSource.replace(routeDeclaration, `${routeDeclaration}${declarationsToAdd}`);
}

const expiryRegression = `\ntest("Phase 10 spreadsheet expiry dates use the same UTC date-only semantics as PDF rows", () => {\n  assert.match(inventoryImportSource, /T00:00:00Z/);\n  assert.match(inventoryImportSource, /toISOString\\(\\)\\.slice\\(0, 10\\) !== trimmed/);\n  assert.match(inventoryImportSource, /Date\\.UTC\\(now\\.getUTCFullYear\\(\\), now\\.getUTCMonth\\(\\), now\\.getUTCDate\\(\\)\\)/);\n  assert.doesNotMatch(inventoryImportSource, /new Date\\(\\`\\$\\{trimmed\\}T00:00:00\\`\\)/);\n});\n`;
if (!contractSource.includes("Phase 10 spreadsheet expiry dates use the same UTC date-only semantics as PDF rows")) {
  contractSource += expiryRegression;
}

const costRegression = `\ntest("physical stock receipt is not blocked when procurement cost is unknown", () => {\n  assert.doesNotMatch(stockDomainSource, /PRODUCT_COST_PRICE_REQUIRED/);\n  assert.doesNotMatch(stockDomainSource, /requireProductCostPrice/);\n  assert.match(stockDomainSource, /return explicitUnitCost \\?\\? product\\.costPrice \\?\\? null/);\n  assert.match(prismaSchemaSource, /unitCost\\s+Decimal\\?\\s+@map\\("unit_cost"\\)/);\n  assert.match(nullableCostMigrationSource, /MODIFY \\`unit_cost\\` DECIMAL\\(10, 2\\) NULL/);\n});\n\ntest("Product Bulk Import keeps costPrice as a required onboarding field", () => {\n  assert.match(productImportSource, /const REQUIRED_IMPORT_HEADERS = \\[[\\s\\S]*?"costPrice"/);\n  assert.match(productImportSource, /parseMoney\\(costPriceRaw, "costPrice"/);\n});\n`;
if (!contractSource.includes("physical stock receipt is not blocked when procurement cost is unknown")) {
  contractSource += costRegression;
}

writeFileSync(contractPath, contractSource);
console.log("Added Phase 10 cost-unblock regression contracts.");
