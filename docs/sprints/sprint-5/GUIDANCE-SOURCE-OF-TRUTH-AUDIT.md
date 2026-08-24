# Sprint 5 Guidance and Source-of-Truth Audit

## Status

**Completed.** Sprint 5 consolidated the major repository guidance surfaces that previously caused stale or duplicated context.

The audit preserved historical evidence rather than deleting it for token savings. Active agent routing now points at a smaller set of current canonical sources and loads domain detail only when relevant.

## Canonical Source Map

| Concern                             | Canonical Current Source                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Active sprint                       | `config/guardrails.json`                                                        |
| Project/thesis scope classification | `docs/PROJECT-SCOPE.md`                                                         |
| Current repository layout           | `docs/architecture/03-folder-architecture.md`                                   |
| Module ownership                    | `docs/architecture/08-module-ownership.md`                                      |
| Cross-cutting execution policy      | `docs/standards/010-golden-rules.md`                                            |
| Implemented behavior                | Current source code/tests                                                       |
| Application commands                | `package.json`                                                                  |
| Database schema                     | `database/prisma/schema.prisma`                                                 |
| Migration history                   | `database/migrations/`                                                          |
| API contracts                       | Relevant file under `docs/api/`                                                 |
| Security guidance                   | Relevant file under `docs/security/`                                            |
| Testing/local verification          | `docs/standards/LOCAL-GUARDRAILS.md` + relevant `testing/` guide                |
| CI/merge validation                 | `docs/standards/CI-GUARDRAILS.md`                                               |
| Forecasting architecture            | `docs/architecture/06-forecasting-architecture.md` + forecasting contract/tests |
| Deployment/release                  | Relevant `deployment/` guide                                                    |
| Persistent coding-agent context     | `config/repository-context.json` + `tools/repo-context/`                        |

## Resolved Conflicts

### Repository layout

The old planned layout in `docs/standards/02-folder-map.md` no longer defines active paths. It is retained only as a compatibility pointer. `docs/architecture/03-folder-architecture.md` now describes the current top-level repository.

### Ownership

`docs/standards/07-member-ownership.md` now contains collaboration/cross-review rules using current boundaries and delegates the detailed ownership matrix to `docs/architecture/08-module-ownership.md`.

### Project scope

`docs/PROJECT-SCOPE.md` now distinguishes:

- thesis-core requirements;
- currently implemented product extensions such as the current storefront/customer flow;
- future extensions that require separate implementation evidence.

Older broad statements that treated every storefront/online capability as prohibited no longer drive active context. Supplier/B2B ordering is not claimed as implemented; if introduced later, external submission remains owner-approved rather than silently triggered by a recommendation.

### Root README

The root README is now a current repository overview/navigation document instead of a Sprint 1 implementation-status snapshot.

### Golden Rules

`docs/standards/010-golden-rules.md` was reduced from a large duplicate instruction dump into a compact cross-cutting policy/router. Domain-specific implementation detail remains in domain sources and is loaded lazily.

### Verification

Executable commands in `package.json`, local/CI guardrails, and the Sprint 5 risk-based verification tiers define current validation behavior. Generic old checklists no longer justify repeatedly running the full repository gate after every intermediate edit.

## Context Policy by Knowledge Type

| Knowledge                                                  | Policy                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Current source/schema/config/tests                         | Authoritative for implemented behavior. Inspect relevant files only.           |
| Architecture/API/security/database/testing/deployment docs | Index and load by relevant subsystem/task.                                     |
| Current scope/layout/ownership/execution sources           | Stable canonical pointers in repository context.                               |
| Older sprint folders                                       | Historical evidence only; exclude from normal feature-task context.            |
| Implementation artifacts                                   | Retrieve only for traceability/history/status needs.                           |
| Generated `.ysabelle-context/`                             | Local persistent navigation cache; never source authority and never committed. |

## Source Precedence

When sources disagree:

1. current user/task requirement;
2. current source, schema, migrations, tests, and executable configuration for implemented behavior;
3. `docs/PROJECT-SCOPE.md` for scope classification;
4. current subsystem architecture/contracts;
5. active sprint planning/status;
6. historical/superseded records.

A lower-precedence source does not become authoritative merely because it says `official`, `mandatory`, or `approved`.

## Result for Repository Context

`config/repository-context.json` now stores canonical source pointers, subsystem routing, invariants, verification tiers, and cross-layer flows without routing routine tasks through the retired folder/ownership sources.

Task context retrieval is designed to return only relevant guidance and a small primary/secondary file set. Historical sprint records and unrelated domain guides stay out of routine context unless the task requires them.

## Completion Evidence

S5-01 completion requires the repository-context regression suite to enforce the consolidated source map and reject reintroduction of known stale path/status assumptions. The Sprint 5 finalization tests cover these conditions together with freshness and file-priority behavior.
