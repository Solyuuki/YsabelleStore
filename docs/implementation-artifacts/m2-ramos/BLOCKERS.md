# m2 Blockers

## Blocker Log

| Blocker ID | Date       | Related Task               | Cause                                                                             | Impact                                                                                         | Resolution                                                                                  | Status                                              |
| ---------- | ---------- | -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| BLK-M2-001 | 2026-06-24 | Backend feature planning   | Database schema had not yet been implemented.                                     | Prisma-backed services and feature APIs could not safely start.                                | M3 database foundation was merged into the sprint branch on 2026-06-29.                     | Resolved for foundation; feature APIs still pending |
| BLK-M2-002 | 2026-06-25 | M2 branch evidence         | `origin/m2/v0.1/feat/backend-core` has no unique commits beyond `origin/staging`. | Artifact reconstruction cannot claim separate M2 branch implementation evidence.               | Documents now distinguish assigned M2 scope from shared-history backend foundation commits. | Documented                                          |
| BLK-M2-003 | 2026-06-29 | Backend service validation | No backend test suite exists.                                                     | Backend correctness is validated only by build and source review, not automated service tests. | Record as future QA requirement.                                                            | Open                                                |
| BLK-M2-004 | 2026-06-29 | Migration application      | Initial migration SQL is reviewable but not documented as applied to local MySQL. | Backend cannot claim database runtime deployment readiness.                                    | Keep as deployment limitation until migration status/application evidence exists.           | Open                                                |

## Active Blockers

| Blocker ID | Owner   | Current Status | Required Action                                                                   |
| ---------- | ------- | -------------- | --------------------------------------------------------------------------------- |
| BLK-M2-003 | m2      | Open           | Add backend test framework and tests when business endpoints begin.               |
| BLK-M2-004 | m2 / m3 | Open           | Apply migration to approved local MySQL or record formal migration status output. |

## Severity Guide

| Severity | Meaning                                | Response                          |
| -------- | -------------------------------------- | --------------------------------- |
| Low      | Documentation evidence limitation      | Record transparently              |
| Medium   | Validation coverage gap                | Add tests or clearly mark pending |
| High     | Backend runtime or data integrity risk | Stop feature merge until resolved |
