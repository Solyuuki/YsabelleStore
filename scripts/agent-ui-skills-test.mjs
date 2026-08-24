import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expected = [
  "ui-ux-pro-max",
  "21st-cli-use",
  "21st-ai",
  "motion-dev-animations",
  "ysabelle-ui-orchestrator"
];

let failures = 0;
for (const name of expected) {
  const file = path.join(root, ".agents", "skills", name, "SKILL.md");
  if (!fs.existsSync(file)) {
    console.error(`MISSING ${file}`);
    failures++;
    continue;
  }

  const text = fs.readFileSync(file, "utf8");
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    console.error(`INVALID frontmatter: ${file}`);
    failures++;
    continue;
  }

  if (
    !new RegExp(`^name:\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(
      frontmatter[1]
    )
  ) {
    console.error(`WRONG name in ${file}`);
    failures++;
  }

  if (!/^description:\s*Use when\b/m.test(frontmatter[1])) {
    console.error(`DESCRIPTION must start with "Use when": ${file}`);
    failures++;
  }
}

if (failures) {
  console.error(`agent UI skill validation failed: ${failures} problem(s)`);
  process.exit(1);
}

console.log(`agent UI skill validation passed: ${expected.length}/${expected.length}`);
