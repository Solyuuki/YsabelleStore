export function createPrepushPlan({ memberKey }) {
  const memberArgs = ["--", "--member", memberKey];

  return [
    {
      args: ["scripts/guardrail-preflight.mjs", "--member", memberKey],
      command: "node",
      label: "guardrail preflight",
      mutates: false
    },
    {
      args: ["run", "verify:code"],
      command: "npm",
      label: "code verification",
      mutates: false
    },
    {
      args: ["run", "status:update", ...memberArgs, "--validation", "Passed"],
      command: "npm",
      label: "status update",
      mutates: true
    },
    {
      args: ["run", "verify:status", ...memberArgs],
      command: "npm",
      label: "status verification",
      mutates: false
    }
  ];
}
