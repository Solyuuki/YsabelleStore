import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function supportLogoBytes() {
  const directories = [
    path.resolve(process.cwd(), "assets", "email"),
    path.resolve(process.cwd(), "backend", "assets", "email")
  ];

  for (const directory of directories) {
    try {
      return Buffer.from(
        readFileSync(path.join(directory, "ysabelle-support-logo.png.b64"), "utf8").trim(),
        "base64"
      );
    } catch {
      // Check the other supported test working directory.
    }
  }

  throw new Error("Static support logo asset was not found.");
}

test("static support signature logo reconstructs as a lightweight transparent PNG", () => {
  const bytes = supportLogoBytes();
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.ok(bytes.length > 500, "Expected a non-empty optimized PNG.");
  assert.ok(bytes.length < 20_000, "Email signature must remain lightweight.");
  assert.equal(bytes.readUInt32BE(16), 64);
  assert.equal(bytes.readUInt32BE(20), 64);
  const colorType = bytes[25];
  assert.ok(
    colorType === 3 || colorType === 4 || colorType === 6,
    "Expected a transparency-capable PNG color mode."
  );
  assert.notEqual(
    bytes.indexOf(Buffer.from("tRNS", "ascii")),
    -1,
    "Expected transparent palette entries."
  );
});
