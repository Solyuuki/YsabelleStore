import fs from "node:fs";

import { getBranch, getStatusShort, getUpstream } from "./lib/git-utils.mjs";
import {
  getRequiredSprintFiles,
  inferMemberFromBranch,
  MEMBERS,
  REQUIRED_ARTIFACT_FILES,
  requireSprint,
  artifactDir
} from "./lib/member-utils.mjs";
import { printTable, runCommand } from "./lib/run-command.mjs";

const branch = getBranch();
const upstream = getUpstream();
const member = inferMemberFromBranch(branch);
const sprint = requireSprint(branch);
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredScripts = [
  "healthcheck",
  "prisma:clean",
  "artifact-update",
  "artifact-check",
  "sprint-update",
  "sprint-check",
  "push-ready",
  "prepush:local"
];
const rows = [];

console.log("YsabelleStore Healthcheck\n");
addCheck("Current branch", branch !== "unknown", branch);
addCheck(
  "Inferred member",
  Boolean(member),
  member ? member.key : "Warning: use --member m1/m2/m3 for update scripts."
);
addCheck(
  "Upstream",
  Boolean(upstream),
  upstream ?? "No upstream found; fallback Git diffs will be used."
);
addCheck("Git status", true, getStatusShort() || "Working tree clean.");
addCheck(
  "Node version",
  runCommand("node", ["--version"]).ok,
  runCommand("node", ["--version"]).stdout.trim()
);
addCheck(
  "npm version",
  runCommand("npm", ["--version"]).ok,
  runCommand("npm", ["--version"]).stdout.trim()
);
addCheck("Root package.json", fs.existsSync("package.json"), "package.json");
addCheck("Sprint folder", fs.existsSync(sprint.sprintDir), sprint.sprintDir);

for (const script of requiredScripts) {
  addCheck(
    `package script ${script}`,
    Boolean(packageJson.scripts?.[script]),
    packageJson.scripts?.[script] ?? "Missing"
  );
}

for (const folder of ["frontend", "backend", "electron"]) {
  addCheck(`${folder} workspace folder`, fs.existsSync(folder), folder);
}

addCheck(
  "Prisma schema",
  fs.existsSync("database/prisma/schema.prisma"),
  "database/prisma/schema.prisma"
);
addCheck(
  "Environment file",
  fs.existsSync(".env") || fs.existsSync(".env.example"),
  ".env or .env.example"
);
addCheck("Sprint docs folder", fs.existsSync("docs/sprints"), "docs/sprints");
addCheck(
  "Implementation artifacts folder",
  fs.existsSync("docs/implementation-artifacts"),
  "docs/implementation-artifacts"
);

for (const memberInfo of Object.values(MEMBERS)) {
  const dir = artifactDir(memberInfo.key);
  addCheck(`Artifact folder ${memberInfo.key}`, fs.existsSync(dir), dir);

  for (const fileName of REQUIRED_ARTIFACT_FILES) {
    addCheck(
      `${memberInfo.key}/${fileName}`,
      fs.existsSync(`${dir}/${fileName}`),
      "Required artifact file."
    );
  }
}

for (const filePath of getRequiredSprintFiles(sprint.sprintDir)) {
  addCheck(filePath, fs.existsSync(filePath), `Required ${sprint.sprintSlug} file.`);
}

const prismaValidate = runCommand("npm", ["run", "prisma:validate"]);
addCheck(
  "Prisma schema validation",
  prismaValidate.ok,
  prismaValidate.ok ? "Schema validates." : "Run npm run prisma:validate for details."
);

printTable(["Check", "Status", "Notes"], rows);

if (rows.some((row) => row[1] === "FAIL")) {
  process.exit(1);
}

function addCheck(name, ok, notes) {
  const critical = !name.startsWith("Inferred member") && !name.startsWith("Upstream");
  rows.push([name, ok ? "PASS" : critical ? "FAIL" : "WARN", notes]);
}
