# Member Ownership and Cross-Review Rules

The canonical module ownership matrix is [`../architecture/08-module-ownership.md`](../architecture/08-module-ownership.md). This standard defines the collaboration workflow around that ownership using the **current** repository layout.

Ownership reduces accidental overlap; it does not prevent a coherent cross-layer task from touching multiple modules when the change is required and reviewed.

## Current Primary Areas

| Member | Primary Areas |
| --- | --- |
| m1 - Abarado | Frontend/UI, Electron integration, repository/documentation quality. |
| m2 - Ramos | Backend/API, Prisma/database integration, migrations/import workflows. |
| m3 - Vito | SARIMA forecasting, forecast evaluation, recommendation/analytics logic. |

Refer to `docs/architecture/08-module-ownership.md` for the current detailed review matrix. Current repository paths such as `frontend/`, `backend/`, `database/`, `electron/`, and `forecasting-service/` are authoritative over historical planning paths.

## Cross-Review Expectations

| Change | Review/Coordination |
| --- | --- |
| API contract affects UI | Backend owner + frontend reviewer. |
| Forecast request/output contract changes | Forecasting + backend reviewers; frontend when presentation changes. |
| Database schema affects forecasting data | Database + forecasting reviewers. |
| POS/inventory mutation crosses UI/API/database | Review all affected boundaries; preserve transactional stock invariants. |
| Electron startup affects backend lifecycle | Electron + backend review. |
| Shared architecture/standards change | Review by all materially affected areas. |

## Task Record

A meaningful implementation task should be traceable through:

- task/sprint identity when applicable;
- assigned or accountable owner;
- requested behavior and acceptance criteria;
- materially affected files/modules;
- verification result;
- blocker/risk or architectural decision when one exists.

Do not create documentation churn for trivial edits solely to satisfy a template. Update implementation artifacts when the repository's established guardrails require them.

## Cross-Ownership Rules

- Do not make unrelated changes inside another member's area.
- A required cross-layer fix may modify another area when the task cannot be completed correctly otherwise; keep the change focused and obtain the normal review before merge.
- Shared contracts require affected-area awareness because a locally correct edit can still break another layer.
- The current user/task requirement may authorize implementation work, but it does not waive repository validation or review expectations for merge/release.

## Completion Check

- [ ] The change is scoped to the requested behavior.
- [ ] Current paths and ownership sources were used.
- [ ] Shared contracts/invariants were considered.
- [ ] Required verification evidence exists.
- [ ] Unrelated modules were not rewritten.
