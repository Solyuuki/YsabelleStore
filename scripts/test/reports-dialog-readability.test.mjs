import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g);
  assert.equal(rgb?.length, 3);
  const [r, g, b] = rgb.map((pair) => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test("all Reports and Receiving return-document portals carry the shared readability class", () => {
  const filesAndCounts = [
    ["frontend/src/components/reports/RestockPlanningPanel.tsx", 1],
    ["frontend/src/components/reports/RestockDraftsPanel.tsx", 1],
    ["frontend/src/components/reports/RestockOrderHistoryPanel.tsx", 1],
    ["frontend/src/components/reports/RestockReceivingPanel.tsx", 2],
    ["frontend/src/components/reports/ReportDownloadDialog.tsx", 1],
    ["frontend/src/components/receiving/ReturnHistoryDialog.tsx", 1],
    ["frontend/src/components/receiving/ReturnReportDialog.tsx", 1]
  ];

  for (const [file, count] of filesAndCounts) {
    const source = read(file);
    assert.equal(
      source.match(/<DialogContent className="ys-report-modal /g)?.length ?? 0,
      count,
      file + ": missing shared dark report-dialog scope"
    );
  }
});

test("Reports dialog control and content contrast meets WCAG AA", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  assert.match(
    css,
    /:root\.dark\[data-appearance-scope="retail"\] \[role="dialog"\]\.ys-report-modal/
  );
  for (const selector of [
    '[class~="text-slate-700"]',
    '[class~="text-slate-400"]',
    '[class~="bg-white"]',
    "button:disabled",
    'button[class~="bg-white"]',
    "input, textarea)::placeholder",
    '[class~="bg-amber-50"]',
    '[class~="bg-red-50"]'
  ]) {
    assert.ok(css.includes(selector), "Missing Reports modal selector: " + selector);
  }
  const pairs = [
    ["main copy", "#f1f5ff", "#1b283e"],
    ["secondary copy", "#d0dcf0", "#25354e"],
    ["secondary buttons", "#f2f6ff", "#2e405c"],
    ["secondary buttons hover", "#ffffff", "#3b506f"],
    ["placeholder", "#c3d2e7", "#17263d"],
    ["warning text", "#ffe2b2", "#423525"],
    ["error text", "#ffd2db", "#402b36"],
    ["indigo badge", "#ddd5ff", "#343457"]
  ];
  for (const [label, ink, surface] of pairs) {
    assert.ok(css.includes(ink) && css.includes(surface), "Missing color token: " + label);
    const ratio = contrast(ink, surface);
    assert.ok(ratio >= 4.5, label + " insufficient contrast: " + ratio.toFixed(2));
  }
});

test("Reports modal dark selectors are scoped and do not override light styling", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  assert.ok(css.includes("/* Sprint 11: Reports dialogs render in Radix portals"));
  assert.ok(css.includes(':root.dark[data-appearance-scope="retail"]'));
  assert.ok(!css.includes(':root.light [role="dialog"].ys-report-modal'));
});

test("Receiving return-document actions use readable dark report styling without disabling actions", () => {
  const history = read("frontend/src/components/receiving/ReturnHistoryDialog.tsx");
  const report = read("frontend/src/components/receiving/ReturnReportDialog.tsx");

  assert.match(history, /<DialogContent className="ys-report-modal /);
  assert.match(history, /onClick=\{\(\) => onView\(order\)\}/);
  assert.match(history, /View report/);
  assert.match(history, /variant="secondary"/);
  assert.doesNotMatch(history, /disabled=\{[^}]*\}[^>]*>\s*View report/);
  assert.match(report, /<DialogContent className="ys-report-modal /);
  assert.match(report, /Download PDF/);
  assert.match(report, /Print/);
  assert.match(report, /Excel-compatible CSV/);

  const css = read("frontend/src/styles/theme-retail.css");
  const modalStyles = css.slice(
    css.indexOf("/* Sprint 11: Reports dialogs render in Radix portals")
  );
  assert.match(modalStyles, /\[role="dialog"\]\.ys-report-modal/);
  assert.match(modalStyles, /\[class~="text-slate-700"\]/);
  assert.match(modalStyles, /button\[class~="bg-white"\]/);
  assert.match(modalStyles, /:hover:not\(:disabled\)/);
});
