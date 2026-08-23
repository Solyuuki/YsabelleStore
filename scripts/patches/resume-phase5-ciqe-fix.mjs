import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const patcherPath = path.join(process.cwd(), "scripts", "patches", "apply-phase5-ciqe-fix.mjs");

if (!fs.existsSync(patcherPath)) {
  throw new Error("Missing scripts/patches/apply-phase5-ciqe-fix.mjs");
}

const rawSource = fs.readFileSync(patcherPath, "utf8");
const newline = rawSource.includes("\r\n") ? "\r\n" : "\n";
let source = rawSource.replace(/\r\n/g, "\n");

const originalGuard = `  const first = text.indexOf(from);
  if (first < 0) throw new Error(\`Could not locate \${replacement.label} in \${replacement.path}\`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(\`Multiple matches for \${replacement.label} in \${replacement.path}\`);
  text = text.slice(0, first) + to + text.slice(first + from.length);`;

const resumableGuard = `  let first = text.indexOf(from);
  if (first < 0) throw new Error(\`Could not locate \${replacement.label} in \${replacement.path}\`);
  const second = text.indexOf(from, first + from.length);
  if (second >= 0) {
    if (replacement.label === "close request discards image drafts") {
      // The same Dialog onOpenChange block exists in CreateProductDialog and ProductDetailsDialog.
      // This replacement belongs to ProductDetailsDialog, which is the later occurrence in this file.
      first = text.lastIndexOf(from);
    } else {
      throw new Error(\`Multiple matches for \${replacement.label} in \${replacement.path}\`);
    }
  }
  text = text.slice(0, first) + to + text.slice(first + from.length);`;

if (source.includes(originalGuard)) {
  source = source.replace(originalGuard, resumableGuard);
  fs.writeFileSync(patcherPath, source.replace(/\n/g, newline), "utf8");
  console.log("updated patcher: disambiguated ProductDetailsDialog close lifecycle replacement");
} else if (!source.includes('replacement.label === "close request discards image drafts"')) {
  throw new Error("Could not locate the expected patcher guard after normalizing line endings. Stop instead of guessing.");
}

await import(`${pathToFileURL(patcherPath).href}?resume=${Date.now()}`);
