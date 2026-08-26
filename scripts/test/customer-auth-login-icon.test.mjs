import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer login uses an access key icon instead of an exit-like login glyph", () => {
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");

  assert.match(login, /import \{ Eye, EyeOff, KeyRound \} from "lucide-react";/);
  assert.match(login, /<KeyRound size=\{22\} \/>/);
  assert.doesNotMatch(login, /\bLogIn\b/);
});
