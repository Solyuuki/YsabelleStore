import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const EXPECTED_SHA256 =
  "12c660a6a2c80f44ae97bc4607764e971a8bed71c15a7e724884dae0ed5ebc4a";
const EXPECTED_SIZE = 1_562_778;
const SOURCE_NAMES = [
  "Glossy Beauty Shopping Cart Orb.png",
  "store-entrance-logo.png"
];
const DESTINATION = resolve(
  process.cwd(),
  "frontend/public/brand/store-entrance-logo.png"
);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify(path) {
  if (!existsSync(path)) {
    throw new Error(`Store entrance logo is missing: ${path}`);
  }

  const size = statSync(path).size;
  const hash = sha256(path);

  if (size !== EXPECTED_SIZE || hash !== EXPECTED_SHA256) {
    throw new Error(
      [
        "The storefront entrance logo does not match the approved PNG.",
        `Expected size: ${EXPECTED_SIZE} bytes`,
        `Actual size:   ${size} bytes`,
        `Expected SHA:  ${EXPECTED_SHA256}`,
        `Actual SHA:    ${hash}`
      ].join("\n")
    );
  }

  return { size, hash };
}

function candidateSources() {
  const explicit = process.argv.find(
    (arg) => !arg.startsWith("--") && arg !== process.argv[1]
  );
  const home = homedir();

  const candidates = explicit ? [resolve(process.cwd(), explicit)] : [];

  for (const name of SOURCE_NAMES) {
    candidates.push(
      resolve(process.cwd(), name),
      resolve(home, "Downloads", name),
      resolve(home, "Desktop", name)
    );
  }

  return candidates;
}

const verifyOnly = process.argv.includes("--verify");

try {
  if (verifyOnly) {
    const result = verify(DESTINATION);
    console.log("Store entrance logo verified.");
    console.log(`Path:   ${DESTINATION}`);
    console.log(`Size:   ${result.size} bytes`);
    console.log(`SHA256: ${result.hash}`);
    process.exit(0);
  }

  const source = candidateSources().find(
    (candidate) => existsSync(candidate) && sha256(candidate) === EXPECTED_SHA256
  );

  if (!source) {
    throw new Error(
      [
        "Could not find the approved Ysabelle entrance logo.",
        "Put the uploaded PNG in Downloads, or pass its path explicitly:",
        'npm run storefront:entrance:logo:install -- "C:\\path\\to\\logo.png"'
      ].join("\n")
    );
  }

  verify(source);
  mkdirSync(dirname(DESTINATION), { recursive: true });

  if (resolve(source) !== DESTINATION) {
    copyFileSync(source, DESTINATION);
  }

  const result = verify(DESTINATION);

  console.log("Installed the approved Ysabelle entrance logo byte-for-byte.");
  console.log(`Source: ${source}`);
  console.log(`Target: ${DESTINATION}`);
  console.log(`Size:   ${result.size} bytes`);
  console.log(`SHA256: ${result.hash}`);
  console.log("No conversion, resize, compression, or background processing was applied.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
