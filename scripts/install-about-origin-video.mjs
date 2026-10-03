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
  "28b458ffced16e4900aa8699e1d80a3497916d3c0b4d5a091a81d161e9ec07bf";
const EXPECTED_SIZE = 3_117_523;
const SOURCE_NAME = "gemini_generated_video_09d5c3a9.mp4";
const DESTINATION = resolve(
  process.cwd(),
  "frontend/public/media/about-origin-motion.mp4"
);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify(path) {
  if (!existsSync(path)) {
    throw new Error(`About origin video is missing: ${path}`);
  }

  const size = statSync(path).size;
  const hash = sha256(path);

  if (size !== EXPECTED_SIZE || hash !== EXPECTED_SHA256) {
    throw new Error(
      [
        "The About origin video does not match the approved Gemini MP4.",
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
    console.log("About origin video verified.");
    console.log(`Path:   ${DESTINATION}`);
    console.log(`Size:   ${result.size} bytes`);
    console.log(`SHA256: ${result.hash}`);
    process.exit(0);
  }

  const source = candidateSources().find((candidate) => existsSync(candidate));

  if (!source) {
    throw new Error(
      [
        "Could not find the approved Gemini About MP4.",
        `Expected filename: ${SOURCE_NAME}`,
        "Put it in your Downloads folder or pass its path explicitly:",
        `npm run storefront:about-origin:install -- "C:\\path\\to\\${SOURCE_NAME}"`
      ].join("\n")
    );
  }

  verify(source);
  mkdirSync(dirname(DESTINATION), { recursive: true });

  if (resolve(source) !== DESTINATION) {
    copyFileSync(source, DESTINATION);
  }

  const result = verify(DESTINATION);

  console.log("Installed the approved Gemini About MP4 byte-for-byte.");
  console.log(`Source: ${source}`);
  console.log(`Target: ${DESTINATION}`);
  console.log(`Size:   ${result.size} bytes`);
  console.log(`SHA256: ${result.hash}`);
  console.log("No re-encoding, trimming, or baked visual treatment was applied.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
