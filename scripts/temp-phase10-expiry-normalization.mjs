import { readFileSync, writeFileSync } from "node:fs";

const inventoryServicePath = "backend/src/services/inventoryImportService.ts";
const contractPath = "backend/test/bulk-delivery-phase10-contract.test.ts";

const inventorySource = readFileSync(inventoryServicePath, "utf8");
const oldParser = `  const parsed = new Date(\`\${trimmed}T00:00:00\`);\n\n  if (Number.isNaN(parsed.getTime())) {\n    errors.push(\n      buildIssue(\n        rowNumber,\n        "expirationDate",\n        "INVALID_EXPIRATION_DATE",\n        "Expiration date is not valid.",\n        trimmed\n      )\n    );\n    return null;\n  }\n\n  const today = new Date();\n  today.setHours(0, 0, 0, 0);\n\n  if (parsed.getTime() < today.getTime()) {`;
const newParser = `  // Treat supplier expiry values as calendar dates, never local timestamps.\n  // Excel/CSV and PDF must normalize the same YYYY-MM-DD to the same UTC date key.\n  const parsed = new Date(\`\${trimmed}T00:00:00Z\`);\n\n  if (\n    Number.isNaN(parsed.getTime()) ||\n    parsed.toISOString().slice(0, 10) !== trimmed\n  ) {\n    errors.push(\n      buildIssue(\n        rowNumber,\n        "expirationDate",\n        "INVALID_EXPIRATION_DATE",\n        "Expiration date is not valid.",\n        trimmed\n      )\n    );\n    return null;\n  }\n\n  const now = new Date();\n  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());\n\n  if (parsed.getTime() < todayUtc) {`;

if (!inventorySource.includes(oldParser)) {
  if (!inventorySource.includes("T00:00:00Z")) {
    throw new Error("Could not locate the inventory expiration parser to patch.");
  }
  console.log("Inventory expiry parser is already UTC-normalized.");
} else {
  writeFileSync(inventoryServicePath, inventorySource.replace(oldParser, newParser));
  console.log("Normalized spreadsheet expiry parsing to UTC date-only semantics.");
}

let contractSource = readFileSync(contractPath, "utf8");
const sourceDeclarationAnchor = `const routeSource = readFileSync(resolve(process.cwd(), "src/routes/inventory.routes.ts"), "utf8");\n`;
const inventoryDeclaration = `const inventoryImportSource = readFileSync(\n  resolve(process.cwd(), "src/services/inventoryImportService.ts"),\n  "utf8"\n);\n`;

if (!contractSource.includes("const inventoryImportSource = readFileSync(")) {
  if (!contractSource.includes(sourceDeclarationAnchor)) {
    throw new Error("Could not locate Phase 10 contract source declaration anchor.");
  }
  contractSource = contractSource.replace(
    sourceDeclarationAnchor,
    `${sourceDeclarationAnchor}${inventoryDeclaration}`
  );
}

const regressionTest = `\ntest("Phase 10 spreadsheet expiry dates use the same UTC date-only semantics as PDF rows", () => {\n  assert.match(inventoryImportSource, /T00:00:00Z/);\n  assert.match(inventoryImportSource, /toISOString\\(\\)\\.slice\\(0, 10\\) !== trimmed/);\n  assert.match(inventoryImportSource, /Date\\.UTC\\(now\\.getUTCFullYear\\(\\), now\\.getUTCMonth\\(\\), now\\.getUTCDate\\(\\)\\)/);\n  assert.doesNotMatch(inventoryImportSource, /new Date\\(\\`\\$\\{trimmed\\}T00:00:00\\`\\)/);\n});\n`;

if (!contractSource.includes("Phase 10 spreadsheet expiry dates use the same UTC date-only semantics as PDF rows")) {
  contractSource += regressionTest;
  writeFileSync(contractPath, contractSource);
  console.log("Added Phase 10 expiry normalization regression contract.");
}
