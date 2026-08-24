import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../frontend/src/utils/storefrontImages.ts", import.meta.url),
  "utf8"
);

assert.match(source, /import \{ resolveApiUrl \} from "@\/config\/runtime"/);
assert.match(source, /normalized\.startsWith\("\/api\/"\)/);
assert.match(source, /resolveApiUrl\(normalized\)\.toString\(\)/);

console.log("storefront dynamic image url routing contract passed");
