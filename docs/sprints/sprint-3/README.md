# Sprint 3 Planning Index

Sprint 3 moves YsabelleStore from auth polish into the first functional business workflow for the thesis system:
Products -> Inventory -> Sales/POS -> Forecasting/SARIMA -> Reports.

This sprint is still not the final thesis system. The goal is to make the core modules functional enough to support
clean forecasting, inventory recommendation work, and a credible Sprint 4 demo path.

## Sprint 3 Member Ownership

| Member       | Role                                | Updated Scope                                                                                        | Status Target              |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------- |
| M1 / Abarado | Fullstack / Integration Lead        | UI cleanup, POS, Sales, app shell consistency, integration QA, merge conflict handling               | Integration and validation |
| M2 / Ramos   | SARIMA / Forecasting / Reports Lead | Forecasting foundation, SARIMA service structure, forecast contract, reports foundation              | Forecast foundation        |
| M3 / Vito    | Products / Inventory Lead           | Product data foundation, inventory data foundation, stock movement logic, clean data for forecasting | Data foundation            |

## Sprint Metadata

| Field         | Details                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Sprint        | Sprint 3                                                                                                         |
| Version       | `v0.3`                                                                                                           |
| Sprint branch | `sprint/v0.3/sprint-3`                                                                                           |
| Sprint status | Planned                                                                                                          |
| Primary focus | Core inventory, POS, sales, SARIMA foundation, and reports                                                       |
| Excluded work | Final recommendation engine, fully trained SARIMA production pipeline, release packaging, auth/security redesign |

## Sprint 3 Priority Order

| Order | Member | Task                                                                  |
| ----- | ------ | --------------------------------------------------------------------- |
| 1     | M3     | Define clean product and inventory data contracts                     |
| 2     | M2     | Define forecast input/output contract and SARIMA service skeleton     |
| 3     | M1     | Connect POS and Sales flows to the new data foundations               |
| 4     | All    | Validate integration, resolve conflicts, and prepare Sprint 4 handoff |

## Planning Documents

| Document                                       | Purpose                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md)               | Defines the Sprint 3 goal and expected outcome                   |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md)         | Groups Sprint 3 tasks by owner, module, dependencies, and status |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) | Defines completion requirements for Sprint 3 work                |
| [MEMBER-ASSIGNMENTS.md](MEMBER-ASSIGNMENTS.md) | Indexes the per-member Sprint 3 assignment files                 |
| [DAILY-WORKFLOW.md](DAILY-WORKFLOW.md)         | Describes the daily operating rhythm for Sprint 3                |
| [RISK-PLAN.md](RISK-PLAN.md)                   | Documents delivery and integration risks                         |
| [SPRINT-REVIEW.md](SPRINT-REVIEW.md)           | Provides the expected review and handoff lens                    |
| [members/m1-abarado.md](members/m1-abarado.md) | M1 integration, UI cleanup, POS, and Sales scope                 |
| [members/m2-ramos.md](members/m2-ramos.md)     | M2 SARIMA, Forecast, and Reports scope                           |
| [members/m3-vito.md](members/m3-vito.md)       | M3 Products, Inventory, and stock movement scope                 |

## Sprint Rule

Sprint 3 is the first business-workflow sprint. Auth, trusted-device flow, logout confirmation, session restore,
dynamic health footer, and role handling from Sprint 2 must remain intact.

The sprint should avoid fake completion. If SARIMA or reports are only foundations, the docs must say so clearly.
If POS or Sales only have partial flow support, the docs must describe that state honestly.

## Sprint 3 Blockers and Ownership

| Blocker                                                 | Owner     | Status  |
| ------------------------------------------------------- | --------- | ------- |
| POS requires product/inventory data to be usable        | M1 and M3 | Pending |
| Sales aggregation requires clean transaction input      | M1 and M2 | Pending |
| SARIMA depends on historical sales and product data     | M2 and M3 | Pending |
| UI cleanup should stay limited to spacing and alignment | M1        | Pending |
| Merge conflicts across feature branches                 | M1        | Pending |
| Reports data contract is not yet finalized              | M2        | Pending |

M1 owns integration and UI consistency. M2 owns forecasting and reports foundations. M3 owns product and inventory
data reliability. Shared contracts should be finalized early so each branch can stay focused.

## Latest Sprint Activity

| Date       | Member     | Branch                               | Latest Activity                                                                                                  | Validation Status |
| ---------- | ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-07-08 | M1 Abarado | `m1/v0.2/feat/auth-fullstack-flow`   | Sprint 3 planning documentation was created from the current Sprint 2 system state.                              | Pending           |
| 2026-07-09 | M1 Abarado | `m1/v0.3/feat/pos-sales-integration` | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.                    | Passed            |
| 2026-07-10 | M1 Abarado | m1/v0.3/feat/pos-sales-integration   | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed            |
| 2026-07-10 | M1 Abarado | sprint/v0.3/sprint-3                 | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed            |
| 2026-07-10 | M3 Vito    | sprint/v0.3/sprint-3                 | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed            |
| 2026-07-11 | M1 Abarado | sprint/v0.3/sprint-3                 | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.                    | Passed            |
| 2026-07-12 | M1 Abarado | sprint/v0.3/sprint-3                 | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed            |
