import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDistributionRecordOverrides,
  buildAssetMaterializationPlan,
  parseDistributionRecords,
  processedCardAliases
} from "../canonical-asset-materializer.mjs";
const id = "sarima-p999-aaaaaaaaaaaa",
  sha = "1".repeat(64),
  blob = "a".repeat(40);
const rows = [
  "candidateId\trole\tsizeBytes\tsha256\tgitBlobOid",
  id + "\toriginal\t10\t" + sha + "\t" + blob,
  id + "\tprocessed\t20\t" + sha + "\t" + blob,
  id + "\tcard\t20\t" + sha + "\t" + blob,
  id + "\tpdp\t30\t" + sha + "\t" + blob,
  ""
].join("\n");
test("distribution roles parse", () =>
  assert.deepEqual(
    parseDistributionRecords(rows).map((r) => r.role),
    ["original", "processed", "card", "pdp"]
  ));
test("derived runtime records can be explicitly overridden", () => {
  const replacementSha = "2".repeat(64);
  const replacementBlob = "b".repeat(40);
  const records = applyDistributionRecordOverrides(parseDistributionRecords(rows), [
    {
      candidateId: id,
      role: "pdp",
      sizeBytes: 31,
      sha256: replacementSha,
      gitBlobOid: replacementBlob
    }
  ]);
  const pdp = records.find((record) => record.role === "pdp");
  assert.equal(pdp?.sizeBytes, 31);
  assert.equal(pdp?.sha256, replacementSha);
  assert.equal(pdp?.gitBlobOid, replacementBlob);
  assert.equal(records.find((record) => record.role === "original")?.sizeBytes, 10);
});
test("plan uses Git source and manifest aliases", () => {
  const release = {
      products: [
        {
          sourceProductId: "P999",
          sourceImage: { path: "database/canonical/product-images/sources/P999.jpg" }
        }
      ]
    },
    reconciliation = {
      items: [{ sourceProductId: "P999", candidateId: id, originalExtension: "jpg" }]
    },
    plan = buildAssetMaterializationPlan({
      release,
      reconciliation,
      recordsText: rows,
      runtimeRoot: "/runtime",
      root: "/repo"
    });
  assert.equal(plan.length, 4);
  assert.deepEqual([...processedCardAliases(plan)], [id]);
});
