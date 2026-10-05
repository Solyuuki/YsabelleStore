import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const EXPECTED_SHA256 = "53360d489f4303761658cc62cc5984f4ea43116b470ae7e63d263c48497e4df3";
const EXPECTED_SIZE = 5_417_920;
const SOURCE_NAME = "gemini_generated_video_9a2cd402.mp4";
const DESTINATION = resolve(process.cwd(), "frontend/public/media/store-entrance.mp4");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify(path) {
  if (!existsSync(path)) {
    throw new Error(`Store entrance video is missing: ${path}`);
  }

  const size = statSync(path).size;
  const hash = sha256(path);

  if (size !== EXPECTED_SIZE || hash !== EXPECTED_SHA256) {
    throw new Error(
      [
        "The storefront entrance video does not match the approved final Gemini MP4.",
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
  const explicit = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const home = homedir();

  return [
    explicit ? resolve(process.cwd(), explicit) : null,
    resolve(process.cwd(), SOURCE_NAME),
    resolve(process.cwd(), "frontend/public/media", SOURCE_NAME),
    resolve(home, "Downloads", SOURCE_NAME),
    resolve(home, "Desktop", SOURCE_NAME)
  ].filter(Boolean);
}

const verifyOnly = process.argv.includes("--verify");

try {
  if (verifyOnly) {
    const result = verify(DESTINATION);
    console.log("Store entrance video verified.");
    console.log(`Path:   ${DESTINATION}`);
    console.log(`Size:   ${result.size} bytes`);
    console.log(`SHA256: ${result.hash}`);
    process.exit(0);
  }

  const source = candidateSources().find((candidate) => existsSync(candidate));

  if (!source) {
    throw new Error(
      [
        "Could not find the approved Gemini entrance MP4.",
        `Expected filename: ${SOURCE_NAME}`,
        "Put it in your Downloads folder or pass its path explicitly:",
        `npm run storefront:entrance:install -- "C:\\path\\to\\${SOURCE_NAME}"`
      ].join("\n")
    );
  }

  verify(source);
  mkdirSync(dirname(DESTINATION), { recursive: true });

  if (resolve(source) !== DESTINATION) {
    copyFileSync(source, DESTINATION);
  }

  const result = verify(DESTINATION);

  console.log("Installed the original Gemini MP4 byte-for-byte.");
  console.log(`Source: ${source}`);
  console.log(`Target: ${DESTINATION}`);
  console.log(`Size:   ${result.size} bytes`);
  console.log(`SHA256: ${result.hash}`);
  console.log("No re-encoding, trimming, shader, or baked transition was applied.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
