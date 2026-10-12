import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(data) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function assertValidPng(path, size) {
  const data = readFileSync(new URL(`../../${path}`, import.meta.url));

  assert.ok(data.subarray(0, 8).equals(PNG_SIGNATURE), `${path}: invalid PNG signature`);
  assert.equal(data.readUInt32BE(16), size, `${path}: incorrect width`);
  assert.equal(data.readUInt32BE(20), size, `${path}: incorrect height`);

  let offset = 8;
  let hasData = false;
  let hasEnd = false;

  while (offset < data.length) {
    assert.ok(offset + 12 <= data.length, `${path}: incomplete chunk header`);
    const length = data.readUInt32BE(offset);
    assert.ok(length <= data.length - offset - 12, `${path}: truncated PNG chunk`);

    const type = data.toString("ascii", offset + 4, offset + 8);
    const expected = data.readUInt32BE(offset + 8 + length);
    const actual = crc32(data.subarray(offset + 4, offset + 8 + length));

    assert.equal(actual, expected, `${path}: invalid ${type} checksum`);
    hasData ||= type === "IDAT";
    hasEnd ||= type === "IEND";
    offset += length + 12;

    if (type === "IEND") {
      break;
    }
  }

  assert.ok(hasData && hasEnd, `${path}: missing image data or end marker`);
  assert.equal(offset, data.length, `${path}: unexpected trailing bytes`);
}

test("bundled responsive Ysabelle marks contain intact PNG data", () => {
  assertValidPng("frontend/src/assets/brand/ysabelle-approved-mark-128.png", 128);
  assertValidPng("frontend/src/assets/brand/ysabelle-approved-mark-180.png", 180);
});

test("brand components do not reference damaged legacy logo exports", () => {
  for (const path of [
    "frontend/src/components/brand/BrandLogo.tsx",
    "frontend/src/components/customer/YsabelleBrandMark.tsx"
  ]) {
    const component = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

    assert.match(component, /srcSet=\{APPROVED_MARK_SOURCES\}/);
    assert.doesNotMatch(component, /ysabelle-store-mark-256\.png|ysabelle-logo-official\.webp/);
  }
});
