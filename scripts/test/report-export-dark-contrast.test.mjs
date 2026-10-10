import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Print and CSV export cards have their own scoped icon and copy classes", () => {
  const dialog = read("frontend/src/components/reports/ReportDownloadDialog.tsx");
  assert.equal((dialog.match(/ys-report-export-option--secondary/g) ?? []).length, 2);
  assert.equal((dialog.match(/ys-report-export-option__icon/g) ?? []).length, 2);
  assert.equal((dialog.match(/ys-report-export-option__title/g) ?? []).length, 2);
  assert.equal((dialog.match(/ys-report-export-option__description/g) ?? []).length, 2);
  assert.match(dialog, /<Printer aria-hidden="true" className="ys-report-export-option__icon/);
  assert.match(dialog, /<FileSpreadsheet aria-hidden="true" className="ys-report-export-option__icon/);
  assert.match(dialog, /onClick=\{\(\) => void handlePrint\(\)\}/);
  assert.match(dialog, /onClick=\{\(\) => void handleCsv\(\)\}/);
  assert.match(dialog, /onClick=\{\(\) => void handlePdf\(\)\}/);
});

test("Dark Mode styling reaches Radix portal controls while Light Mode stays unchanged", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  const dialog = read("frontend/src/components/ui/dialog.tsx");
  assert.match(dialog, /<DialogPortal>/);
  assert.match(css, /:root\.dark\[data-appearance-scope="retail"\]/);
  assert.match(css, /\[role="dialog"\]\s+\.ys-report-export-option--secondary/);
  assert.match(css, /\.ys-report-export-option--secondary \.ys-report-export-option__icon/);
  assert.match(css, /\.ys-report-export-option--secondary \.ys-report-export-option__title/);
  assert.match(css, /\.ys-report-export-option--secondary \.ys-report-export-option__description/);
  assert.match(css, /\.ys-report-export-option--secondary:hover:not\(:disabled\)/);
  assert.match(css, /\.ys-report-export-option--secondary:focus-visible/);
  assert.match(css, /\.ys-report-export-option--secondary:disabled/);
});
