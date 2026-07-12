import fs from "node:fs";

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
  "SPRINT-PROGRESS.md"
];

export function parseMemberOverride(args = process.argv.slice(2)) {
  const memberFlagIndex = args.findIndex((arg) => arg === "--member");
  const memberValue =
    memberFlagIndex >= 0
      ? args[memberFlagIndex + 1]
      : args.find((arg) => arg.startsWith("--member="))?.split("=")[1];

  if (!memberValue) {
    return null;
  }

  const prefix = memberValue.toLowerCase().slice(0, 2);
  return MEMBERS[prefix] ?? null;
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

export function requireSprint(branch) {
  const inferred = inferSprintFromBranch(branch);

  if (!inferred) {
    throw new Error(
      "Unable to determine sprint version from branch name. Expected format: m1/v0.3/feat/name"
    );
  }

  if (!fs.existsSync(inferred.sprintDir)) {
    throw new Error(`Resolved sprint folder ${inferred.sprintDir} does not exist.`);
  }

  return inferred;
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
