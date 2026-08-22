const AREA_RULES = [
  ["Frontend", (file) => file.startsWith("frontend/")],
  ["Backend", (file) => file.startsWith("backend/")],
  ["Database", (file) => file.startsWith("database/")],
  ["Electron", (file) => file.startsWith("electron/")],
  ["Forecasting", (file) => file.startsWith("forecasting-service/")],
  [
    "Scripts / CI",
    (file) =>
      file.startsWith("scripts/") ||
      file.startsWith(".github/") ||
      file.startsWith(".husky/") ||
      ["package.json", "package-lock.json"].includes(file)
  ],
  [
    "Docs",
    (file) => file.startsWith("docs/") || file.endsWith(".md") || file.startsWith("deployment/")
  ]
];

export function classifyChanges(changes) {
  const files = changes.map((change) => change.file);
  const areas = new Set();

  for (const file of files) {
    const match = AREA_RULES.find(([, matches]) => matches(file));
    areas.add(match?.[0] ?? "Other");
  }

  return {
    areas: [...areas],
    decisions: detectDecisions(files),
    deploymentRelevant: files.some((file) =>
      /^(electron\/|deployment\/|database\/prisma\/|database\/migrations\/|backend\/src\/(services|database|controllers)\/|package\.json|package-lock\.json)/i.test(
        file
      )
    ),
    files,
    importantFiles: files.slice(0, 10),
    manualQa: files.some((file) =>
      /frontend\/src\/(context|pages|app)|backend\/src\/(routes|controllers|services)\/[^/]*auth|trusted|toast/i.test(
        file
      )
    ),
    risky: files.some((file) =>
      /backend\/|database\/|auth|security|migration|prisma|package\.json|package-lock\.json/i.test(
        file
      )
    ),
    summaries: detectSummaries(files)
  };
}

function detectSummaries(files) {
  const summaries = new Set();

  if (files.some((file) => /auth|trusted-device|trusteddevice|welcomepage|authcontext|auth\.routes/i.test(file))) {
    summaries.add("Authentication / session / access-control changes");
  }

  if (files.some((file) => /toast/i.test(file))) {
    summaries.add("Toast notification lifecycle");
  }

  if (
    files.some((file) => /schema\.prisma|database\/(prisma\/migrations|migrations)\//i.test(file))
  ) {
    summaries.add("Database schema / migration update");
  }

  if (files.some((file) => file.startsWith("scripts/") || file === "package.json")) {
    summaries.add("Automation / validation scripts");
  }

  if (files.some((file) => file.startsWith("docs/"))) {
    summaries.add("Sprint and implementation documentation");
  }

  if (summaries.size === 0 && files.length > 0) {
    summaries.add("Repository maintenance");
  }

  return [...summaries];
}

function detectDecisions(files) {
  const decisions = [];

  if (files.some((file) => /trusteddevice|trusted-device|trusted_device/i.test(file))) {
    decisions.push({
      decision: "Trusted-device access behavior changed.",
      reason: "Trusted-device changes require explicit review of session, revocation, and access behavior."
    });
  }

  if (files.some((file) => file.startsWith("scripts/") || file === "package.json")) {
    decisions.push({
      decision: "Repository automation or validation behavior changed.",
      reason: "Automation changes require repeatable guardrail and validation checks before push."
    });
  }

  if (files.some((file) => /toast/i.test(file))) {
    decisions.push({
      decision: "User notification lifecycle changed.",
      reason: "Notification changes require review for contradictory, stale, or duplicated feedback."
    });
  }

  return decisions;
}

export function statusFor(validationStatus, classified) {
  if (validationStatus === "Passed" && !classified.manualQa && !classified.risky) {
    return "Completed";
  }

  if (validationStatus === "Passed" && (classified.manualQa || classified.risky)) {
    return classified.manualQa ? "Manual QA Required" : "Needs Review";
  }

  return classified.risky ? "Needs Review" : "In Progress";
}
