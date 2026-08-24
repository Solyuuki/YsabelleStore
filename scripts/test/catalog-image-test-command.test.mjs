import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

test("catalog image tests run from the engine directory without package import assumptions", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));

  assert.equal(
    packageJson.scripts["catalog-images:test"],
    'cd catalog-image-engine && python -m unittest discover -s tests -p "test_*.py"'
  );
});
