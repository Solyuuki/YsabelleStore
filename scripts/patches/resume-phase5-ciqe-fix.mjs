import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const patcherPath = path.join(process.cwd(), "scripts", "patches", "apply-phase5-ciqe-fix.mjs");

if (!fs.existsSync(patcherPath)) {
  throw new Error("Missing scripts/patches/apply-phase5-ciqe-fix.mjs");
}

let source = fs.readFileSync(patcherPath, "utf8");

const originalGuard = `  const first = text.indexOf(from);\n  if (first < 0) throw new Error(\`Could not locate \${replacement.label} in \${replacement.path}\`);\n  if (text.indexOf(from, first + from.length) >= 0) throw new Error(\`Multiple matches for \${replacement.label} in \${replacement.path}\`);\n  text = text.slice(0, first) + to + text.slice(first + from.length);`;

const resumableGuard = `  let first = text.indexOf(from);\n  if (first < 0) throw new Error(\`Could not locate \${replacement.label} in \${replacement.path}\`);\n  const second = text.indexOf(from, first + from.length);\n  if (second >= 0) {\n    if (replacement.label === "close request discards image drafts") {\n      // The same Dialog onOpenChange block exists in CreateProductDialog and ProductDetailsDialog.\n      // This replacement belongs to ProductDetailsDialog, which is the later occurrence in this file.\n      first = text.lastIndexOf(from);\n    } else {\n      throw new Error(\`Multiple matches for \${replacement.label} in \${replacement.path}\`);\n    }\n  }\n  text = text.slice(0, first) + to + text.slice(first + from.length);`;

if (source.includes(originalGuard)) {
  source = source.replace(originalGuard, resumableGuard);
  fs.writeFileSync(patcherPath, source, "utf8");
  console.log("updated patcher: disambiguated ProductDetailsDialog close lifecycle replacement");
} else if (!source.includes("replacement.label === \"close request discards image drafts\"")) {
  throw new Error("Could not locate the expected patcher guard. Stop instead of guessing.");
}

await import(`${pathToFileURL(patcherPath).href}?resume=${Date.now()}`);
