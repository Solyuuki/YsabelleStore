import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const pos = read("frontend/src/pages/PosPageV2.tsx");
const scanner = read("frontend/src/components/pos/PosCameraScanner.tsx");
const css = read("frontend/src/styles/retail-pos-mobile-scanner.css");
const lock = JSON.parse(read("package-lock.json"));
const pkg = JSON.parse(read("frontend/package.json"));

test("mobile POS exposes real camera Scan action without changing desktop scanner input", () => {
  assert.match(pos, /<PosCameraScanner/);
  assert.match(pos, /open=\{cameraScannerOpen\}/);
  assert.match(pos, /onOpenChange=\{setCameraScannerOpen\}/);
  assert.match(pos, /aria-label="Scan product barcode using phone camera"/);
  assert.match(pos, /className="retail-pos-camera-launch"/);
  assert.match(pos, /setCameraScannerOpen\(true\)/);
  assert.match(pos, /import "@\/styles\/retail-pos-mobile-scanner\.css"/);
  assert.match(css, /\.retail-pos-camera-launch\s*\{\s*display: none;/);
  assert.match(css, /@media \(max-width: 767px\), \(max-height: 500px\) and \(orientation: landscape\)/);
  assert.match(css, /\.retail-pos-camera-launch\s*\{[^}]*display: inline-flex;/);
  assert.match(pos, /ref=\{scannerInputRef\}/);
  assert.match(pos, /onKeyDown=\{\(event\) =>/);
  assert.match(pos, /event\.key === "Enter"/);
  assert.match(pos, /searchPosProducts\(/);
});

test("camera scans use existing exact barcode lookup and stock-limited Add, never bypass checkout", () => {
  assert.match(pos, /onDetected=\{\(barcode\) => \{/);
  assert.match(pos, /setSearchInput\(barcode\)/);
  assert.match(pos, /handleSearch\(\{ queryOverride: barcode, autoAddExactMatch: true, page: 1 \}\)/);
  assert.match(pos, /\(options\.queryOverride \?\? searchInput\)\.trim\(\)/);
  assert.match(pos, /resolveExactProductMatch\(trimmedQuery, response\.data\.products\)/);
  assert.match(pos, /product\.barcode\?\.toLowerCase\(\) === normalizedQuery/);
  assert.match(pos, /product\.sku\.toLowerCase\(\) === normalizedQuery/);
  assert.match(pos, /if \(options\.autoAddExactMatch && exactMatch\)/);
  assert.match(pos, /if \(product\.availableStock <= 0\)/);
  assert.match(pos, /existingLine\.quantity >= product\.availableStock/);
  assert.match(pos, /checkoutPosSale\(/);
});

test("barcode decoding works across browsers and closes camera tracks on exit", () => {
  assert.equal(pkg.dependencies["@zxing/browser"], "0.1.5");
  assert.equal(pkg.dependencies["@zxing/library"], "0.21.3");
  assert.equal(lock.packages.frontend.dependencies["@zxing/browser"], "0.1.5");
  assert.equal(lock.packages["node_modules/@zxing/library"].version, "0.21.3");
  assert.match(scanner, /BrowserMultiFormatReader\(HINTS, \{/);
  for (const format of ["EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128", "CODE_39", "ITF"]) {
    assert.ok(scanner.includes("BarcodeFormat." + format), "Missing barcode format " + format);
  }
  assert.match(scanner, /DecodeHintType\.TRY_HARDER/);
  assert.match(scanner, /facingMode: \{ ideal: "environment" \}/);
  assert.match(scanner, /width: \{ ideal: 1920 \}/);
  assert.match(scanner, /height: \{ ideal: 1080 \}/);
  assert.match(scanner, /focusMode: "continuous"/);
  assert.match(scanner, /controlsRef\.current\?\.stop\(\)/);
  assert.match(scanner, /trackRef\.current\?\.stop\(\)/);
  assert.match(scanner, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(scanner, /detectedRef\.current = true;/);
});

test("camera permission states, touch controls and iOS safeguards are accessible", () => {
  assert.match(scanner, /window\.isSecureContext/);
  assert.match(scanner, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(scanner, /NotAllowedError/);
  assert.match(scanner, /NotFoundError/);
  assert.match(scanner, /NotReadableError/);
  assert.match(scanner, /Camera permission was denied/);
  assert.match(scanner, /Use manual search/);
  assert.match(scanner, /aria-live="polite"/);
  assert.match(scanner, /aria-label="Close camera scanner"/);
  assert.match(scanner, /aria-label="Live rear-camera barcode preview"/);
  assert.match(scanner, /playsInline/);
  assert.match(scanner, /type="button"/);
  assert.match(scanner, /className="pos-camera-scanner__aim"/);
  assert.match(scanner, /torchAvailable/);
  assert.match(scanner, /zoomRange/);
  assert.match(css, /\.pos-camera-scanner__video\s*\{[^}]*filter: none !important;/);
  assert.match(css, /\.pos-camera-scanner__close,[\s\S]*?min-height: 44px;/);
  assert.match(css, /\.pos-camera-scanner__preview\s*\{[^}]*aspect-ratio: 4 \/ 3;/);
});

test("phone search and product cards are compact, usable and theme-aware", () => {
  assert.match(css, /\.retail-pos-search-form\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.pos-scanner-field\s*\{[^}]*grid-column: 1 \/ -1;/);
  assert.match(css, /td\[data-label="Product"\]\s*\{[^}]*grid-column: 1 \/ -1;/);
  assert.match(css, /td\[data-label="Stock"\]\s*\{[^}]*grid-row: 2;/);
  assert.match(css, /td\[data-label="Unit price"\]\s*\{[^}]*grid-row: 2;/);
  assert.match(css, /td\[data-label="Action"\]\s*\{[^}]*grid-row: 3;/);
  assert.match(css, /td\[data-label="Action"\] button\s*\{[^}]*min-height: 44px;/);
  assert.match(css, /\.pos-camera-scanner\s*\{[^}]*background: #19283e;/);
  assert.match(css, /\.pos-camera-scanner__status\s*\{[^}]*color: #d8e5f8;/);
});
