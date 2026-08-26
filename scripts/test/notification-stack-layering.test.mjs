import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const notificationStackSource = await readFile(
  new URL("../../frontend/src/components/shared/NotificationStack.tsx", import.meta.url),
  "utf8"
);
const customerCssSource = await readFile(
  new URL("../../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);

function extractToastZIndex(source) {
  const match = source.match(/className="[^"]*\bz-\[(\d+)\][^"]*"/);
  assert.ok(match, "NotificationStack must declare an explicit arbitrary z-index class");
  return Number(match[1]);
}

function extractCustomerHeaderZIndex(source) {
  const match = source.match(/\.customer-header\s*\{[\s\S]*?z-index:\s*(\d+)\s*;/);
  assert.ok(match, "customer header must declare an explicit z-index");
  return Number(match[1]);
}

test("notification stack renders above the sticky customer header", () => {
  const notificationZIndex = extractToastZIndex(notificationStackSource);
  const customerHeaderZIndex = extractCustomerHeaderZIndex(customerCssSource);

  assert.ok(
    notificationZIndex > customerHeaderZIndex,
    `notification stack z-index (${notificationZIndex}) must be above customer header (${customerHeaderZIndex})`
  );
});
