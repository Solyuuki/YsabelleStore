import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const EXPECTED_SHA256 = "6738635db4cf22b744aba5ced30bc4a9533245e0f02352df406381d21487dad9";
const EXPECTED_SIZE = 2_554_527;
const SOURCE_NAME = "gemini_generated_video_4013f49c.mp4";
const DESTINATION = resolve(
  process.cwd(),
  "frontend/public/media/about-origin-motion-6738635d.mp4"
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

function matchingGeminiCopies(directory) {
  if (!existsSync(directory)) return [];

  const pattern = /^gemini_generated_video_4013f49c(?: \(\d+\))?\.mp4$/i;

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
    console.log("About origin video verified.");
    console.log(`Path:   ${DESTINATION}`);
    console.log(`Size:   ${result.size} bytes`);
    console.log(`SHA256: ${result.hash}`);
    process.exit(0);
  }

  if (existsSync(DESTINATION)) {
    try {
      const result = verify(DESTINATION);
      console.log("About origin video is already installed and verified.");
      console.log(`Path:   ${DESTINATION}`);
      console.log(`Size:   ${result.size} bytes`);
      console.log(`SHA256: ${result.hash}`);
      process.exit(0);
    } catch {
      console.warn(
        "Existing About origin video is stale and will be replaced if the approved source is available."
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
        `Approved About origin video source not found. Leaving the tracked runtime asset untouched.`
      );
      process.exit(0);
    }

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
