import { requireMember, requireSprint } from "./member-utils.mjs";

export function loadGuardrailContext({ args = [], branch, rootDir = process.cwd() }) {
  return {
    member: requireMember(branch, args),
    sprint: requireSprint(branch, { rootDir })
  };
}
