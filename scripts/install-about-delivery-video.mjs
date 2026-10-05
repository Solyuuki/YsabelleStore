import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const EXPECTED_SHA256 = "83b7547e99884795c14c5590400e09205c084eeca201c9c227da56b012745c6c";
const EXPECTED_SIZE = 3_374_456;
const SOURCE_NAME = "gemini_generated_video_ac2b4173.mp4";
const DESTINATION = resolve(
  process.cwd(),
  "frontend/public/media/about-delivery-operations-83b7547e.mp4"
);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify(path) {
  if (!existsSync(path)) {
    throw new Error(`About delivery video is missing: ${path}`);
  }

  const size = statSync(path).size;
  const hash = sha256(path);

  if (size !== EXPECTED_SIZE || hash !== EXPECTED_SHA256) {
    throw new Error(
      [
        "The About delivery video does not match the approved Gemini MP4.",
        `Expected size: ${EXPECTED_SIZE} bytes`,
        `Actual size:   ${size} bytes`,
        `Expected SHA:  ${EXPECTED_SHA256}`,
        `Actual SHA:    ${hash}`
      ].join("\n")
    );
  }

  return { size, hash };
}

function matchingGeminiCopies(directory) {
  if (!existsSync(directory)) return [];

  const pattern = /^gemini_generated_video_ac2b4173(?: \(\d+\))?\.mp4$/i;

  return readdirSync(directory)
    .filter((name) => pattern.test(name))
    .map((name) => resolve(directory, name));
}

function candidateSources() {
  const explicit = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const home = homedir();
  const downloads = resolve(home, "Downloads");
  const desktop = resolve(home, "Desktop");

  return [
    explicit ? resolve(process.cwd(), explicit) : null,
    resolve(process.cwd(), SOURCE_NAME),
    resolve(process.cwd(), "frontend/public/media", SOURCE_NAME),
    ...matchingGeminiCopies(downloads),
    ...matchingGeminiCopies(desktop)
  ].filter(Boolean);
}

const verifyOnly = process.argv.includes("--verify");
const ifPresent = process.argv.includes("--if-present");

try {
  if (verifyOnly) {
    const result = verify(DESTINATION);
    console.log("About delivery video verified.");
    console.log(`Path:   ${DESTINATION}`);
    console.log(`Size:   ${result.size} bytes`);
    console.log(`SHA256: ${result.hash}`);
    process.exit(0);
  }

  if (existsSync(DESTINATION)) {
    try {
      const result = verify(DESTINATION);
      console.log("About delivery video is already installed and verified.");
      console.log(`Path:   ${DESTINATION}`);
      console.log(`Size:   ${result.size} bytes`);
      console.log(`SHA256: ${result.hash}`);
      process.exit(0);
    } catch {
      console.warn(
        "Existing About delivery video is stale and will be replaced if the approved source is available."
      );
    }
  }

  const source = candidateSources().find((candidate) => {
    if (!existsSync(candidate)) return false;

    try {
      verify(candidate);
      return true;
    } catch {
      return false;
    }
  });

  if (!source) {
    if (ifPresent) {
      console.warn(
        "Approved About delivery video source not found. Delivery preview will use its fallback visual."
      );
      process.exit(0);
    }

    throw new Error(
      [
        "Could not find the approved Gemini delivery MP4.",
        `Expected filename: ${SOURCE_NAME}`,
        "Put it in your Downloads folder or pass its path explicitly:",
        `npm run storefront:about-delivery:install -- "C:\\path\\to\\${SOURCE_NAME}"`
      ].join("\n")
    );
  }

  verify(source);
  mkdirSync(dirname(DESTINATION), { recursive: true });

  if (resolve(source) !== DESTINATION) {
    copyFileSync(source, DESTINATION);
  }

  const result = verify(DESTINATION);

  console.log("Installed the approved Gemini delivery MP4 byte-for-byte.");
  console.log(`Source: ${source}`);
  console.log(`Target: ${DESTINATION}`);
  console.log(`Size:   ${result.size} bytes`);
  console.log(`SHA256: ${result.hash}`);
  console.log("No re-encoding, trimming, or baked visual treatment was applied.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
