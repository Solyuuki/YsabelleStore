# Risk Plan

Sprint 1 risk management focuses on integration, branch discipline, and avoiding accidental business feature work.

## Risk Register

| Risk ID    | Risk                                                           | Severity | Owner                    | Mitigation                                                               |
| ---------- | -------------------------------------------------------------- | -------- | ------------------------ | ------------------------------------------------------------------------ |
| RSK-S1-001 | Sprint branch receives unreviewed direct commits               | High     | m1 - Abarado             | Require PR flow and branch governance checks                             |
| RSK-S1-002 | Business modules start before infrastructure is ready          | High     | m1 - Abarado             | Keep backlog scoped to infrastructure and reject unrelated PR scope      |
| RSK-S1-003 | Prisma schema changes break backend assumptions                | High     | m2 - Ramos, m3 - Vito    | Review schema and backend integration together                           |
| RSK-S1-004 | Frontend shell diverges from backend API contract              | Medium   | m1 - Abarado, m2 - Ramos | Use shared response standards and API client boundary                    |
| RSK-S1-005 | Electron integration exposes unsafe desktop APIs               | High     | m1 - Abarado             | Keep context isolation, sandboxing, and IPC allowlist discipline         |
| RSK-S1-006 | Validation fails because local database environment is missing | Medium   | m2 - Ramos, m3 - Vito    | Document `DATABASE_URL` validation requirement and use safe local values |
| RSK-S1-007 | Merge conflicts slow Sprint 1 integration                      | Medium   | m1 - Abarado             | Merge small PRs into the sprint branch and coordinate shared files early |
| RSK-S1-008 | Documentation falls behind implementation decisions            | Medium   | m1, m2, m3               | Update affected docs in the same PR as infrastructure changes            |

## Escalation Rules

| Situation                   | Action                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| Cross-owner file conflict   | Ask affected owner before editing                                |
| Prisma migration conflict   | Stop and coordinate with m3 before merge                         |
| Backend contract conflict   | Coordinate with m2 before frontend service changes merge         |
| UI shell conflict           | Coordinate with m1 before layout or Electron entry changes merge |
| CI failure on sprint branch | Fix before additional feature PRs merge                          |

## Carry-Over Rule

Unfinished Sprint 1 tasks must be listed in [SPRINT-REVIEW.md](SPRINT-REVIEW.md) with owner, reason, risk, and next sprint recommendation.
