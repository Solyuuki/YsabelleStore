import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile("frontend/src/styles/customer-auth-recovery.css", "utf8");

assert.match(
  css,
  /@media\s*\(min-width:\s*761px\)[\s\S]*?\.customer-recovery-intro h1\s*\{[^}]*max-width:\s*none;[^}]*white-space:\s*nowrap;/s,
  "Recovery desktop headline must stay on one clean line."
);

console.log("Recovery typography contract passed.");
