import fs from "node:fs";
import path from "node:path";

export const MEMBERS = {
  m1: {
    displayName: "M1 Abarado",
    key: "m1-abarado"
  },
  m2: {
    displayName: "M2 Ramos",
    key: "m2-ramos"
  },
  m3: {
    displayName: "M3 Vito",
    key: "m3-vito"
  }
};

export const REQUIRED_ARTIFACT_FILES = [
  "README.md",
  "TASKS.md",
  "DAILY-NOTES.md",
  "DECISIONS.md",
  "BLOCKERS.md",
  "TESTING-REPORTS.md",
  "DEPLOYMENT-NOTES.md",
  "SPRINT-PLANNING.md",
  "SPRINT-PROGRESS.md",
  "VALIDATION-SUMMARY.md"
];

const GUARDRAIL_CONFIG_PATH = "config/guardrails.json";

export function parseMemberOverride(args = process.argv.slice(2)) {
  const memberFlagIndex = args.findIndex((arg) => arg === "--member");
  const inlineMemberArgument = args.find((arg) => arg.startsWith("--member="));
  const memberValue =
    memberFlagIndex >= 0 ? args[memberFlagIndex + 1] : inlineMemberArgument?.slice(9);

  if (memberFlagIndex < 0 && !inlineMemberArgument) {
    return null;
  }

  const normalizedValue = memberValue?.toLowerCase();
  const member = Object.entries(MEMBERS).find(
    ([alias, details]) => normalizedValue === alias || normalizedValue === details.key
  )?.[1];

  if (!member) {
    throw new Error(
      `Unknown member ${memberValue || "(missing)"}. Use --member m1, --member m2, or --member m3.`
    );
  }

  return member;
}

export function inferMemberFromBranch(branch) {
  const prefix = branch?.split("/")?.[0]?.toLowerCase();

  return MEMBERS[prefix] ?? null;
}

export function inferSprintFromBranch(branch) {
  const match = branch?.match(/\/v(\d+)\.(\d+)\//);

  if (!match) {
    return null;
  }

  const sprintNumber = Number.parseInt(match[2], 10);

  if (!Number.isInteger(sprintNumber) || sprintNumber <= 0) {
    return null;
  }

  return {
    sprintNumber,
    sprintSlug: `sprint-${sprintNumber}`,
    sprintVersion: `v${match[1]}.${match[2]}`,
    sprintDir: `docs/sprints/sprint-${sprintNumber}`
  };
}

export function requireMember(branch, args = process.argv.slice(2)) {
  const override = parseMemberOverride(args);

  if (override) {
    return override;
  }

  const inferred = inferMemberFromBranch(branch);

  if (inferred) {
    return inferred;
  }

  throw new Error(
    "Unable to infer member from branch. Re-run with --member m1, --member m2, or --member m3."
  );
}

export function requireSprint(branch, { rootDir = process.cwd() } = {}) {
  const configPath = path.join(rootDir, ...GUARDRAIL_CONFIG_PATH.split("/"));
  if (!fs.existsSync(configPath)) {
    throw new Error(`Guardrail configuration ${GUARDRAIL_CONFIG_PATH} does not exist.`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const sprintNumber = config.activeSprint;
  if (!Number.isInteger(sprintNumber) || sprintNumber <= 0) {
    throw new Error(`${GUARDRAIL_CONFIG_PATH} activeSprint must be a positive whole number.`);
  }

  const declaredSprint = branch?.match(/(?:^|\/)sprint-(\d+)(?:$|\/)/)?.[1];
  if (declaredSprint && Number.parseInt(declaredSprint, 10) !== sprintNumber) {
    throw new Error(
      `Branch ${branch} declares sprint-${declaredSprint}, but activeSprint is ${sprintNumber} in ${GUARDRAIL_CONFIG_PATH}.`
    );
  }

  const versionMatch = branch?.match(/(?:^|\/)v(\d+\.\d+)(?:$|\/)/);
  const sprintSlug = `sprint-${sprintNumber}`;
  const sprintDir = `docs/sprints/${sprintSlug}`;
  const absoluteSprintDir = path.join(rootDir, ...sprintDir.split("/"));
  if (!fs.existsSync(absoluteSprintDir)) {
    throw new Error(
      `Active sprint folder ${sprintDir} does not exist. Add the required Sprint ${sprintNumber} documentation, or correct activeSprint in ${GUARDRAIL_CONFIG_PATH} if the transition was not intended.`
    );
  }

  return {
    sprintNumber,
    sprintSlug,
    sprintVersion: versionMatch ? `v${versionMatch[1]}` : `sprint-${sprintNumber}`,
    sprintDir
  };
}

export function getRequiredSprintFiles(sprintDir) {
  return [
    `${sprintDir}/README.md`,
    `${sprintDir}/SPRINT-GOAL.md`,
    `${sprintDir}/SPRINT-BACKLOG.md`,
    `${sprintDir}/DEFINITION-OF-DONE.md`,
    `${sprintDir}/MEMBER-ASSIGNMENTS.md`,
    `${sprintDir}/members/m1-abarado.md`,
    `${sprintDir}/members/m2-ramos.md`,
    `${sprintDir}/members/m3-vito.md`
  ];
}

export function artifactDir(memberKey) {
  return `docs/implementation-artifacts/${memberKey}`;
}
