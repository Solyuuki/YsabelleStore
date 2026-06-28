# m1 Blockers

## Blocker Log

| Blocker ID | Date       | Related Task              | Cause                                                                                         | Impact                                                                                                                                                                     | Resolution                                                                                            | Status                                             |
| ---------- | ---------- | ------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| BLK-M1-001 | 2026-06-24 | YSB-M1-DOC-001            | Application scaffold had not started during repository foundation work.                       | Frontend UI work could not begin from repository standards alone.                                                                                                          | Application foundations were added on 2026-06-25 and frontend shell work was completed on 2026-06-27. | Resolved                                           |
| BLK-M1-002 | 2026-06-27 | YSB-M1-UI-001             | `react-router-dom` was not installed in the accepted M1 dependency set.                       | Could not use React Router without changing dependency scope.                                                                                                              | Implemented minimal browser-history routing in `AppShell.tsx`.                                        | Resolved                                           |
| BLK-M1-003 | 2026-06-27 | Root build validation     | Root build required Prisma validation, but `DATABASE_URL` was not set on the first run.       | First `npm run build` failed during validation.                                                                                                                            | Re-ran build with temporary local validation `DATABASE_URL`; validation passed.                       | Resolved                                           |
| BLK-M1-004 | 2026-06-27 | PR guardrails             | PR title validation initially needed support for member-prefixed titles.                      | Valid team PR title style could be rejected.                                                                                                                               | Updated PR title guardrail and documented accepted title formats.                                     | Resolved                                           |
| BLK-M1-005 | 2026-06-29 | Sprint branch integration | M3 database branch contained frontend shell replacements and deleted M1 page/component files. | If M3 frontend files are accepted, sidebar routes can render placeholders, mismatch `/forecast` vs `/forecasts`, or white-screen through incompatible component contracts. | Current sprint branch preserves M1 frontend source; issue is documented as ownership risk.            | Resolved for current branch; monitor future merges |
| BLK-M1-006 | 2026-06-29 | Review artifacts          | Current worktree initially showed deleted M1 screenshot artifact files.                       | Historical screenshot review evidence would be unavailable as live files if the deletion were committed.                                                                   | Restored the screenshot artifacts from Git history during documentation reconstruction.               | Resolved                                           |

## Active Blockers

| Blocker ID | Owner | Current Status | Required Action                                                     |
| ---------- | ----- | -------------- | ------------------------------------------------------------------- |
| None       | None  | Clear          | No active M1 blocker remains after screenshot artifact restoration. |

## Severity Guide

| Severity | Meaning                                                         | Response                                        |
| -------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Low      | Documentation or local evidence issue                           | Record and continue with transparent limitation |
| Medium   | Merge or validation issue that can be resolved locally          | Fix or document before review                   |
| High     | User-facing behavior, source ownership, or build stability risk | Stop merge and coordinate with affected owner   |
