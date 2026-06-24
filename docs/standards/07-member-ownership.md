# Member Ownership

Ownership protects the team from accidental overlap and unclear responsibility. Every task must identify the assigned member, affected files, and validation result.

## Ownership Matrix

| Member | Responsibility | Primary Folders |
| --- | --- | --- |
| m1 - Abarado | Repository governance, documentation quality, React UI shell, Electron packaging | `.github/`, `docs/`, `app/frontend/`, `app/electron/` |
| m2 - Ramos | Express backend, Prisma schema, MySQL migrations, import APIs | `app/backend/`, `prisma/` |
| m3 - Vito | Python SARIMA engine, analytics, recommendation logic, chart validation | `app/forecasting/`, analytics modules |

## Shared Responsibility Matrix

| Area | Primary Owner | Required Reviewers |
| --- | --- | --- |
| Recommendation output contract | m3 | m1, m2 |
| API response contract | m2 | m1 for UI impact, m3 for forecast impact |
| Import data format | m2 | m1 for UI import flow |
| Desktop packaging | m1 | m2 if backend startup changes |
| Database schema | m2 | m3 if forecast data changes |
| Documentation standards | m1 | Affected member |

## Required Task Record

Every task must contain:

| Field | Description |
| --- | --- |
| Task ID | Unique identifier such as `YSB-M2-API-001` |
| Sprint | Sprint number or version |
| Assigned Member | `m1`, `m2`, or `m3` |
| Scope | Clear feature, fix, test, or documentation objective |
| Affected Files | Files or folders expected to change |
| Status | Not Started, In Progress, Blocked, In Review, Done |
| Test Result | Command output summary or documented manual validation |
| Notes | Decisions, risks, or reviewer comments |

## Approval Workflow

| Stage | Required Action |
| --- | --- |
| Task creation | Assign owner and affected files |
| Before coding | Owner confirms branch and scope |
| Before PR | Owner updates task artifact and test result |
| During review | Reviewer checks ownership and affected files |
| Before merge | Owner confirms no unrelated files were changed |

## Cross-Ownership Rules

| Scenario | Required Action |
| --- | --- |
| m1 edits Prisma schema | Must get m2 approval |
| m2 edits React UI shell | Must get m1 approval |
| m3 changes API response shape | Must get m2 approval and notify m1 |
| Any member edits shared recommendation output | Must get all affected owner approval |

## Good vs Bad Examples

| Good Example | Bad Example |
| --- | --- |
| `m2 updates inventory.service.ts and records API tests` | `m2 edits frontend table and schema without review` |
| `m3 changes forecast output with documented contract review` | `m3 changes response fields without notifying API/UI owners` |
| `m1 updates docs and PR template in one docs branch` | `m1 bundles docs, API, and forecasting edits in one PR` |

## Ownership Checklist

- [ ] Task owner is identified
- [ ] Affected files are recorded
- [ ] Shared files have reviewer approval
- [ ] Tests or validation evidence are attached
- [ ] No member modified another member's task without permission

