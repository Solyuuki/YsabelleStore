import fs from "node:fs";

const accountTest = "scripts/customer-account-frontend-test.ts";
let account = fs.readFileSync(accountTest, "utf8");
const checkoutNeedle = `      customerPhone: "09171234567",\n      fulfillmentMethod: "STORE_PICKUP",`;
const addressBlock = `      customerPhone: "09171234567",\n      customerAddress: {\n        addressLine1: "123 Sample Street",\n        addressLine2: "",\n        barangay: "Sample Barangay",\n        cityMunicipality: "Pasig City",\n        provinceRegion: "Metro Manila",\n        postalCode: "1600",\n        country: "Philippines"\n      },\n      fulfillmentMethod: "STORE_PICKUP",`;

const occurrences = account.split(checkoutNeedle).length - 1;
if (occurrences !== 2) {
  throw new Error(`Expected 2 storefront checkout fixtures to patch, found ${occurrences}.`);
}
account = account.split(checkoutNeedle).join(addressBlock);
fs.writeFileSync(accountTest, account);

const lightingTest = "scripts/test/customer-surface-premium-lighting.test.mjs";
let lighting = fs.readFileSync(lightingTest, "utf8");
const oldExpectation = "  assert.match(lighting, /#fcfdff/i);";
const newExpectation = "  assert.match(lighting, /#f4f6fb/i);";
if (!lighting.includes(oldExpectation)) {
  throw new Error("Expected stale storefront lighting color assertion was not found.");
}
lighting = lighting.replace(oldExpectation, newExpectation);
fs.writeFileSync(lightingTest, lighting);

console.log("Sprint 10 stale release fixtures repaired.");
