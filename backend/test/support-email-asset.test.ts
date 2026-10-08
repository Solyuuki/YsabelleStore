import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function emailAssetDirectory() {
  const candidates = [
    path.resolve(process.cwd(), "assets", "email"),
    path.resolve(process.cwd(), "backend", "assets", "email")
  ];

  for (const candidate of candidates) {
    try {
      if (readdirSync(candidate).length >= 0) return candidate;
    } catch {
      // Try the next supported test working directory.
    }
  }

  throw new Error("Support email asset directory was not found.");
}

test("animated support signature asset reconstructs into a complete looping GIF", () => {
  const directory = emailAssetDirectory();
  const parts = readdirSync(directory)
    .filter((name) => /^ysabelle-support-logo\.gif\.b64\.part\d+$/.test(name))
    .sort((left, right) => left.localeCompare(right));

  assert.deepEqual(parts, [
    "ysabelle-support-logo.gif.b64.part00",
    "ysabelle-support-logo.gif.b64.part01",
    "ysabelle-support-logo.gif.b64.part02",
    "ysabelle-support-logo.gif.b64.part03",
    "ysabelle-support-logo.gif.b64.part04",
    "ysabelle-support-logo.gif.b64.part05",
    "ysabelle-support-logo.gif.b64.part06"
  ]);

  const encoded = parts
    .map((name) => readFileSync(path.join(directory, name), "utf8").trim())
    .join("");
  const bytes = Buffer.from(encoded, "base64");

  assert.equal(encoded.length, 24_232);
  assert.equal(bytes.length, 18_173);
  assert.equal(bytes.subarray(0, 6).toString("ascii"), "GIF89a");
  assert.equal(bytes[bytes.length - 1], 0x3b);
  assert.notEqual(bytes.indexOf(Buffer.from("NETSCAPE2.0", "ascii")), -1);

  let graphicControlExtensions = 0;
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) {
      graphicControlExtensions += 1;
    }
  }

  assert.ok(graphicControlExtensions >= 2, "Expected more than one animated GIF frame.");
});
