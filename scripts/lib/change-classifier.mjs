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
      /^(electron\/|deployment\/|database\/prisma\/|database\/migrations\/|backend\/src\/(services|database|controllers)\/|package\.json|package-lock\.json)/.test(
        file
      )
    ),
    files,
    importantFiles: files.slice(0, 10),
    manualQa: files.some((file) =>
      /frontend\/src\/(context|pages|app)|backend\/src\/(routes|controllers|services)\/auth|trusted|Toast/.test(
        file
      )
    ),
    risky: files.some((file) =>
      /backend\/|database\/|auth|security|migration|prisma|package\.json|package-lock\.json/.test(
        file
      )
    ),
    summaries: detectSummaries(files)
  };
}

function detectSummaries(files) {
  const summaries = new Set();

  if (
    files.some((file) =>
      /auth|trusted-device|TrustedDevice|WelcomePage|AuthContext|auth\.routes/.test(file)
    )
  ) {
    summaries.add("Authentication / trusted device login / RBAC");
  }

  if (files.some((file) => /Toast|toast/.test(file))) {
    summaries.add("Toast notification lifecycle");
  }

  if (
    files.some((file) => /schema\.prisma|database\/(prisma\/migrations|migrations)\//.test(file))
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

  if (
    files.some((file) =>
      /TrustedDevice|trusted-device|schema\.prisma|database\/.*trusted_device/.test(file)
    )
  ) {
    decisions.push({
      decision: "Trusted-device access is revocation-based instead of expiration-based.",
      reason:
        "Persistent desktop access must remain valid until explicitly revoked, forgotten, reset, or blocked by inactive account status."
    });
  }

  if (files.some((file) => file.startsWith("scripts/") || file === "package.json")) {
    decisions.push({
      decision: "Local push readiness is automated through deterministic Node.js scripts.",
      reason:
        "Members need repeatable artifact updates, sprint updates, Prisma cleanup, and validation before pushing."
    });
  }

  if (files.some((file) => /Toast|toast/.test(file))) {
    decisions.push({
      decision:
        "Authentication toasts are scoped and auto-dismiss through the shared toast lifecycle.",
      reason: "Auth feedback should avoid contradictory stacking and stale progress notifications."
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
