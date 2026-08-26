import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("desktop customer auth spreads wide left and right without growing vertically", () => {
  const layoutPath = "frontend/src/styles/customer-auth-wide-composition.css";
  assert.equal(
    existsSync(fileUrl(layoutPath)),
    true,
    "wide desktop composition stylesheet must exist"
  );

  const frame = read("frontend/src/components/customer/CustomerAuthFrame.tsx");
  const css = read(layoutPath);

  assert.match(frame, /import "@\/styles\/customer-auth-wide-composition\.css";/);
  assert.match(css, /@media\s*\(min-width:\s*961px\)/);
  assert.match(
    css,
    /\.customer-auth-stage\s*\{[\s\S]*?width:\s*min\(100%,\s*1460px\);[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\);[\s\S]*?gap:\s*clamp\(3rem,\s*5vw,\s*5\.5rem\);/
  );
  assert.match(
    css,
    /\.customer-auth-stage__identity h2\s*\{[\s\S]*?max-width:\s*18ch;[\s\S]*?font-size:\s*clamp\(2\.4rem,\s*3vw,\s*3\.25rem\);/
  );
  assert.match(
    css,
    /\.customer-auth-stage__visual\s*\{[\s\S]*?min-height:\s*11\.5rem;[\s\S]*?max-height:\s*13\.5rem;/
  );
  assert.match(
    css,
    /\.customer-auth-stage__highlights\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/
  );
  assert.match(
    css,
    /\.customer-auth-stage__panel\s*\{[\s\S]*?padding:\s*clamp\(1\.75rem,\s*2\.5vw,\s*2\.75rem\);/
  );
  assert.match(
    css,
    /\.customer-auth-stage__panel \.customer-auth-card\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*36rem;/
  );
  assert.match(
    css,
    /\.customer-auth-page--register \.customer-auth-stage\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\);/
  );
});
