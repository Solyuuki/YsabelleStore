import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer and internal auth surfaces share Ysabelle auth brand primitives", () => {
  const brandStylesPath = "frontend/src/styles/auth-brand.css";

  assert.equal(existsSync(fileUrl(brandStylesPath)), true, "shared auth brand stylesheet must exist");

  const customerApp = read("frontend/src/app/CustomerApp.tsx");
  const appShell = read("frontend/src/app/AppShell.tsx");
  const brandStyles = read(brandStylesPath);

  assert.match(customerApp, /import\s+["']@\/styles\/auth-brand\.css["'];/);
  assert.match(appShell, /import\s+["']@\/styles\/auth-brand\.css["'];/);
  assert.match(brandStyles, /--ys-auth-primary:\s*#625bff;/i);
  assert.match(brandStyles, /--ys-auth-secondary:\s*#008cff;/i);
  assert.match(brandStyles, /--ys-auth-accent:\s*#d946ef;/i);
  assert.match(brandStyles, /--ys-auth-surface:\s*rgb\(255 255 255 \/ 86%\);/i);
  assert.match(brandStyles, /--ys-auth-border:\s*rgb\(98 91 255 \/ 16%\);/i);
});
