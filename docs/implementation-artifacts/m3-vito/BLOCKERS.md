# m3 Blockers

## Blocker Log

| Blocker ID | Date       | Related Task              | Cause                                                                                                              | Impact                                                                                         | Resolution                                                                                        | Status                                                        |
| ---------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| BLK-M3-001 | 2026-06-28 | Database validation       | Prisma validation and generation require a safe `DATABASE_URL`.                                                    | Validation can fail locally if the environment variable is missing.                            | Use a validation-only local MySQL URL, as documented in workflow notes.                           | Resolved for validation; still required for future local runs |
| BLK-M3-002 | 2026-06-28 | Sprint 1 scope            | Earlier artifacts referenced forecasting ownership, but Sprint 1 database task did not implement SARIMA execution. | Risk of overclaiming forecasting implementation.                                               | Artifacts now mark SARIMA and recommendation work as future scope.                                | Resolved                                                      |
| BLK-M3-003 | 2026-06-29 | Merge ownership           | M3 branch contained frontend replacements and deletions outside database scope.                                    | Accepting those frontend files could overwrite M1 UI and break sidebar route behavior.         | Current sprint branch preserves M1 frontend and keeps M3 database/backend database-boundary work. | Resolved for current branch; monitor future merges            |
| BLK-M3-004 | 2026-06-29 | Migration standardization | Existing migration folder uses timestamp naming and is already shared in branch history.                           | Direct rename could break Prisma migration history/checksum expectations and audit continuity. | Do not rename current migration; document sequential naming for future migrations.                | Resolved by policy                                            |
| BLK-M3-005 | 2026-06-29 | Migration runtime         | Migration SQL has not been documented as applied to local MySQL.                                                   | Database runtime readiness cannot be claimed.                                                  | Keep as future validation requirement.                                                            | Open                                                          |

## Active Blockers

| Blocker ID | Owner   | Current Status | Required Action                                                                          |
| ---------- | ------- | -------------- | ---------------------------------------------------------------------------------------- |
| BLK-M3-005 | m3 / m2 | Open           | Apply migration to approved local MySQL or record migration status/application evidence. |

## Watch Items

| Watch ID   | Area               | Description                                                         | Response                                                                     |
| ---------- | ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| WCH-M3-001 | Migration naming   | Future folders must use sequential repository naming.               | Determine highest sequence and increment before creating migration artifact. |
| WCH-M3-002 | Forecasting        | Forecast tables store outputs only; no SARIMA execution is present. | Keep forecasting claims out of Sprint 1 completion reports.                  |
| WCH-M3-003 | Frontend ownership | M3 branches must not replace M1 frontend files.                     | Keep database/backend database-boundary changes separate from UI work.       |

## Severity Guide

| Severity | Meaning                                        | Response                              |
| -------- | ---------------------------------------------- | ------------------------------------- |
| Low      | Documentation or setup issue                   | Record limitation and continue        |
| Medium   | Validation gap or migration naming risk        | Resolve before new migration work     |
| High     | Schema integrity or cross-owner overwrite risk | Stop merge and coordinate with owners |
