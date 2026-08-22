import { requireMember, requireSprint, resolveMember } from "./member-utils.mjs";

export function loadGuardrailContext({
  args = [],
  branch,
  memberRequired = true,
  rootDir = process.cwd()
}) {
  return {
    member: memberRequired ? requireMember(branch, args) : resolveMember(branch, args),
    sprint: requireSprint(branch, { rootDir })
  };
}
