# YsabelleStore Golden Rules

This document is the compact cross-cutting execution policy for repository work. It intentionally does **not** repeat every frontend, API, database, security, testing, forecasting, or deployment rule. Use it to choose the right authoritative source, then load only the domain guidance needed for the task.

## Source Precedence

When guidance conflicts:

1. current user/task requirement;
2. current source code, schema, migrations, tests, and executable configuration for implemented behavior;
3. [`../PROJECT-SCOPE.md`](../PROJECT-SCOPE.md) for current scope classification;
4. current subsystem architecture/contracts;
5. active sprint planning/status;
6. historical sprint records and superseded plans.

Never force current code to match a stale lower-precedence document.

## Global Engineering Rules

- Complete the requested behavior; do not stop at a partial implementation when the remaining work is normal and reversible.
- Preserve every explicit acceptance criterion.
- Keep changes focused; do not bundle unrelated refactors or speculative cleanup.
- Diagnose root causes instead of patching symptoms blindly.
- Preserve existing behavior unless the task explicitly changes it.
- Keep boundaries clear: UI -> API/service -> persistence; React must not directly access Prisma/MySQL.
- Preserve inventory/data integrity and transactionality for stock/sales operations.
- Validate inputs and avoid exposing secrets or sensitive internal details.
- Keep SARIMA responsible for demand forecasting, not expiration-date prediction.
- Prefer readable, maintainable modules over giant mixed-responsibility files.
- Use current repository paths rather than historical planned layouts.

## Context-First Agent Workflow

For coding-agent work inside YsabelleStore:

1. Turn the request into a compact acceptance checklist.
2. Query persistent repository context before broad discovery.
3. Let task retrieval refresh stale context automatically; use `status` when a diagnostic freshness report is needed.
4. Open **primary implementation files first**. Open secondary dependencies only when the task or evidence requires them.
5. Follow direct callers/imports only as needed; do not reread understood files without new evidence.
6. Widen to subsystem discovery only when cached context is insufficient, contradictory, stale after refresh, or an error exposes an undocumented dependency.
7. Use repository-wide discovery only as a last resort.
8. Record meaningful context mismatches instead of silently keeping stale cache.

Generated `.ysabelle-context/` data is a navigation cache, never the implementation source of truth.

## Verification Tiers

| Tier               | Use                                                                                                          | Typical Checks                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1 - Local          | Isolated low-risk implementation/UI/tooling edit                                                             | Targeted test plus affected typecheck/lint/build as applicable.                  |
| 2 - Subsystem      | Multi-file change within one subsystem or contract boundary                                                  | Relevant test group, affected workspace build/typecheck, integration/API checks. |
| 3 - Full/high risk | Inventory/POS integrity, auth/security, schema/database, release/packaging, cross-cutting high-risk behavior | Full required repository verification plus relevant specialized checks.          |

During iteration, run the smallest sufficient check. Near completion, run the final tier appropriate to the risk. Do not rerun an expensive successful check when no relevant code changed afterward.

## Domain Router

| Task Area                    | Primary Guidance                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Current project/thesis scope | `docs/PROJECT-SCOPE.md`                                                              |
| Repository layout            | `docs/architecture/03-folder-architecture.md`                                        |
| Module ownership/review      | `docs/architecture/08-module-ownership.md` + `docs/standards/07-member-ownership.md` |
| General coding               | `docs/standards/06-coding-standards.md`                                              |
| API/contracts                | `docs/api/README.md` and task-specific API contract                                  |
| Database/Prisma              | `database/docs/DATABASE-FOUNDATION.md`, migration guide, current schema              |
| Security/auth                | `docs/security/` relevant topic                                                      |
| Testing/local verification   | `docs/standards/LOCAL-GUARDRAILS.md`, `testing/` relevant topic                      |
| CI/merge quality             | `docs/standards/CI-GUARDRAILS.md`                                                    |
| Forecasting                  | `docs/architecture/06-forecasting-architecture.md`, forecasting contract/tests       |
| Electron/runtime             | `docs/architecture/07-electron-architecture.md`, `electron/README.md`                |
| Deployment/release           | `deployment/` relevant guide                                                         |
| Repository context/MCP       | `tools/repo-context/README.md`, Sprint 5 context plan                                |

Do not load every row for every task.

## Continuation and Clarification

Proceed through normal reversible inspection, implementation, fixes caused by the change, and verification without repeatedly asking whether to continue.

Clarify only when a material requirement cannot be safely inferred, credentials/secrets are needed, the next action is destructive/irreversible, an external side effect needs explicit authorization, or materially different choices produce different required user-facing behavior.

A failing test caused by the current change, a newly discovered relevant file, or the normal next implementation step is not itself a reason to stop.

## Completion Contract

Do not report a task as complete until:

- requested behavior exists;
- no explicit requirement is knowingly omitted;
- relevant domain invariants hold;
- appropriate fresh verification passes, or a genuine external blocker is clearly reported;
- no known issue introduced by the change remains unresolved;
- documentation/context is updated when architecture or source-of-truth routing changed.

Final reports should be concise: outcome, meaningful files/areas changed, verification evidence, and any remaining external blocker or risk.
