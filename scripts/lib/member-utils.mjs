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

export const REQUIRED_SPRINT_FILES = [
  "docs/sprints/sprint-2/README.md",
  "docs/sprints/sprint-2/SPRINT-GOAL.md",
  "docs/sprints/sprint-2/SPRINT-BACKLOG.md",
  "docs/sprints/sprint-2/DEFINITION-OF-DONE.md",
  "docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md",
  "docs/sprints/sprint-2/members/m1-abarado.md",
  "docs/sprints/sprint-2/members/m2-ramos.md",
  "docs/sprints/sprint-2/members/m3-vito.md"
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

export function artifactDir(memberKey) {
  return `docs/implementation-artifacts/${memberKey}`;
}
