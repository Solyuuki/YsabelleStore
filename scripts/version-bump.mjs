import fs from "node:fs";
import path from "node:path";

const VERSION_FILE = path.join("frontend", "src", "config", "appVersion.ts");

const args = parseArgs(process.argv.slice(2));
const nextVersion = args.version;
const sprintNumber = args.sprint;

validateVersion(nextVersion);
validateSprint(sprintNumber);

const filesUpdated = [];
const currentVersion = readCurrentVersion(VERSION_FILE);

if (currentVersion !== nextVersion) {
  writeVersionFile(VERSION_FILE, nextVersion);
  filesUpdated.push(VERSION_FILE);
}

const sprintReadmePath = path.join("docs", "sprints", `sprint-${sprintNumber}`, "README.md");
if (fs.existsSync(sprintReadmePath)) {
  const updated = updateSprintReadmeVersion(sprintReadmePath, nextVersion);
  if (updated) {
    filesUpdated.push(sprintReadmePath);
  }
}

console.log(`Previous version: ${currentVersion}`);
console.log(`New version: ${nextVersion}`);
console.log(`Sprint number: ${sprintNumber}`);
console.log("Files updated:");

if (filesUpdated.length === 0) {
  console.log("- No files changed.");
} else {
  for (const filePath of filesUpdated) {
    console.log(`- ${filePath}`);
  }
}

function parseArgs(argv) {
  const parsed = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, value] = arg.slice(2).split("=", 2);
    if (!key) {
      continue;
    }

    parsed[key] = value ?? "true";
  }

  return parsed;
}

function validateVersion(version) {
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Expected --version in the form "0.2.0".');
  }
}

function validateSprint(sprint) {
  if (!sprint || !/^\d+$/.test(sprint)) {
    throw new Error('Expected --sprint to be a whole number, such as "2".');
  }
}

function readCurrentVersion(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/export const APP_VERSION = "([^"]+)";/);

  if (!match) {
    throw new Error(`Unable to find APP_VERSION in ${filePath}.`);
  }

  return match[1];
}

function writeVersionFile(filePath, version) {
  const content = `export const APP_VERSION = "${version}";\nexport const APP_VERSION_LABEL = \`v\${APP_VERSION}\`;\n`;
  fs.writeFileSync(filePath, content, "utf8");
}

function updateSprintReadmeVersion(filePath, version) {
  const content = fs.readFileSync(filePath, "utf8");
  const nextContent = content.replace(
    /^(\| Version\s+\|\s+)`?v?\d+\.\d+\.\d+`?(\s+\|)$/m,
    `$1\`v${version}\`$2`
  );

  if (nextContent === content) {
    return false;
  }

  fs.writeFileSync(filePath, nextContent, "utf8");
  return true;
}
