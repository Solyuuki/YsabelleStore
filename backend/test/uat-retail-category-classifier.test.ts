import assert from "node:assert/strict";
import test from "node:test";
import { desiredRetailCategorySlug } from "../src/modules/catalog/uatRetailCategoryClassifier.js";

function classify(sku: string, name: string, currentSlug: string, sourceCategory?: string) {
  return desiredRetailCategorySlug({ sku, name, currentSlug, sourceCategory });
}

test("D01 product identity overrides distinguish real dairy from cheese-flavoured snacks", () => {
  assert.equal(classify("SARIMA-P115", "Eden Original Cheese", "baking-dessert"), "dairy-eggs");
  assert.equal(classify("SARIMA-P299", "Piattos Supersized Cheese", "baking-dessert"), "snacks-confectionery");
  assert.equal(classify("SARIMA-P370", "Piattos Cheese", "snacks-confectionery"), "snacks-confectionery");
});

test("D01 corrects misplaced paper, noodles, pantry supplies and chips", () => {
  assert.equal(classify("LOCAL-1", "Bathroom Tissue Roll", "baking-dessert"), "tissue-cotton");
  assert.equal(classify("SARIMA-P209", "Longkow Vermicelli Sotanghon", "juice-tea-soda-water"), "noodles-pasta");
  assert.equal(classify("SARIMA-P301", "Oishi Potato Chips", "condiments-cooking"), "snacks-confectionery");
  assert.equal(classify("SARIMA-P207", "Excellent Gourmet Spoons", "snacks-confectionery"), "household-supplies");
});

test("D01 keeps true frozen food and refuses unknown categories", () => {
  assert.equal(classify("SARIMA-P037", "Purefoods Tender Juicy Hotdog", "frozen-chilled"), "frozen-chilled");
  assert.equal(classify("CUSTOM-1", "Unknown goods", "unmapped-bulk-category"), null);
});
