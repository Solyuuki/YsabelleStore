# CI Guardrails

## Purpose

This standard defines the quality gates that protect YsabelleStore from broken builds, unsafe merges, and incomplete repository changes.

## Scope

These rules apply to GitHub Actions, pull requests, repository quality checks, and release-safe validation. They do not describe feature implementation.

## Required Checks

| Check                                                        | Expected Result                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `npm ci`                                                     | Installs dependencies from the lockfile                           |
| `npm run format:check`                                       | Confirms formatting is clean                                      |
| `npm run lint`                                               | Confirms code quality rules pass                                  |
| `npm run build`                                              | Confirms workspace build succeeds                                 |
| `npm audit --audit-level=high`                               | Confirms there are no unresolved high or critical vulnerabilities |
| `npx prisma validate --schema=database/prisma/schema.prisma` | Confirms Prisma schema is valid                                   |
| Workspace validation                                         | Confirms `frontend`, `backend`, and `electron` remain buildable   |

## Pass Or Fail Meaning

| State | Meaning                                                                                    |
| ----- | ------------------------------------------------------------------------------------------ |
| Pass  | The repository change is safe enough to review or merge under the current foundation rules |
| Fail  | The change must be corrected before merge or release consideration                         |

## What CI Must Block

- Broken builds
- Formatting regressions
- Lint failures
- High or critical dependency vulnerabilities
- Invalid Prisma schema changes
- Unsafe branch names
- Missing or incomplete PR metadata

## What Must Never Be Bypassed

- Security audit failures
- Prisma validation failures
- Branch naming rules for PRs
- Required review workflow
- Ownership rules for shared files

## Foundation Phase Note

During the foundation phase, CI should protect the repository without blocking approved main-branch setup work that already belongs to the existing workflow.

## Implementation Phase Note

During the implementation phase, branch naming, PR metadata, and review discipline should become stricter and should be enforced on every pull request.

## When CI Fails

1. Read the failing job and step name.
2. Reproduce the issue locally with the same command.
3. Fix the root cause, not the failing symptom.
4. Rerun the relevant checks before requesting another review.

## Validation Checklist

- [x] Required checks are listed
- [x] Pass and fail meaning is clear
- [x] Bypass rules are explicit
- [x] Foundation phase behavior is documented
- [x] Implementation phase behavior is documented
