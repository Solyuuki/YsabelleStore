# Sprint 5 Guidance and Source-of-Truth Audit

## Purpose

This audit is the first implementation step for Sprint 5. Its purpose is to identify which repository sources should be treated as authoritative, which guidance should be loaded only when relevant, and which documents currently duplicate or contradict newer repository reality.

The goal is not to delete useful project knowledge. The goal is to preserve it while preventing Codex and other development agents from repeatedly loading broad, duplicated, stale, or conflicting instructions.

## Classification Model

| Classification | Meaning |
| --- | --- |
| `KEEP` | Keep as an active authoritative or near-authoritative source. |
| `INDEX` | Keep in place and expose through the repository context only when the task needs it. |
| `MERGE` | Consolidate overlapping or conflicting material into a smaller canonical source. |
| `MOVE` | Keep the information but relocate it to a more appropriate context/reference layer. |
| `RETIRE` | Stop treating the source as active guidance. Preserve history when useful, but exclude it from normal agent context. |

## Source-of-Truth Precedence

Until the audit is complete, use the following precedence when documents disagree:

1. Current executable source code and runtime configuration for implemented behavior.
2. Current database schema and migrations for persisted data structure.
3. Current package scripts and CI/local verification automation for executable validation behavior.
4. Newer task-specific architecture decisions that describe already-implemented behavior.
5. General architecture and domain contracts that remain consistent with the implementation.
6. Older planning, foundation, scope, or standards documents.

A lower-precedence document must not override current implementation merely because it uses words such as `official`, `mandatory`, or `approved`.

## Immediate Findings

### 1. Repository layout guidance conflicts with the current repository

`docs/architecture/03-folder-architecture.md` uses the current top-level structure (`frontend/`, `backend/`, `electron/`, `database/`, `forecasting-service/`).

`docs/standards/02-folder-map.md` still describes the older planned structure (`app/frontend/`, `app/backend/`, `app/electron/`, `app/forecasting/`, and root `prisma/`). That layout no longer represents the repository.

**Decision:**

- `docs/architecture/03-folder-architecture.md` -> `KEEP` + later wording refresh.
- `docs/standards/02-folder-map.md` -> `RETIRE` from active agent context after any still-useful ownership/history notes are merged.

### 2. Ownership guidance duplicates the same rules with different paths

`docs/architecture/08-module-ownership.md` maps responsibilities to the current module layout.

`docs/standards/07-member-ownership.md` repeats much of the same ownership model but still points to old `app/*` and root `prisma/` paths.

**Decision:**

- `docs/architecture/08-module-ownership.md` -> `KEEP` as the current consolidation target.
- `docs/standards/07-member-ownership.md` -> `MERGE` useful workflow/approval details into the canonical ownership source, then exclude the stale path table from active context.

### 3. Project scope guidance is internally inconsistent with newer implemented storefront work

Several older documents describe online ordering, e-commerce, supplier-related capabilities, web/cloud behavior, or similar areas as excluded. Examples include:

- `README.md`
- `docs/standards/01-big-picture.md`
- `docs/architecture/01-system-framework.md`
- `docs/architecture/10-thesis-scope-alignment.md`

However, the repository also contains newer customer-facing storefront architecture and executable storefront tooling, including:

- `docs/architecture/11-storefront-global-search.md`
- storefront-related scripts in `package.json`
- current storefront source and tests

This means the older broad scope statements cannot safely be treated as the sole active source of truth.

**Decision:**

- The four older broad-scope sources above -> `MERGE` into a future single canonical project-scope source.
- Until that merge is approved, the persistent context must flag scope as a conflict area instead of silently choosing one document.
- Task-specific newer architecture decisions for implemented storefront behavior -> `INDEX` and load only for storefront/customer tasks.

### 4. The root README contains stale project-status information

The root `README.md` still states that the current status is Sprint 1 foundation and describes several modules as unimplemented, while the active branch is Sprint 5 and the repository contains substantially newer functionality and verification scripts.

**Decision:**

- `README.md` -> `MERGE`/refresh into a concise current project overview and navigation index.
- Do not use README sprint/status prose as authoritative runtime or implementation-state context until refreshed.

### 5. The Golden Rules document is valuable but too broad for automatic loading

`docs/standards/010-golden-rules.md` contains useful constraints, but it also repeats material already represented in coding standards, architecture guidance, ownership rules, security policy, validation workflows, artifact policy, Git workflow, database guidance, and forecasting guidance.

It is therefore a poor candidate for unconditional agent context.

**Decision:**

- `docs/standards/010-golden-rules.md` -> `MERGE` and shrink into a compact high-priority policy/router.
- Domain-specific detail should remain in specialized sources and be loaded lazily.
- Preserve genuinely cross-cutting rules such as focused scope, no unrelated rewrites, root-cause fixes, requirement satisfaction, and verification before completion.

### 6. Current verification behavior has stronger sources than generic checklist prose

`package.json` exposes the current executable verification surface, including `verify:code`, `verify:status`, `verify:local`, production security audit, Prisma validation, forecast checks, storefront checks, and other targeted scripts.

`docs/standards/LOCAL-GUARDRAILS.md` documents the mutation/read-only behavior of local verification commands, while `docs/standards/CI-GUARDRAILS.md` documents merge/release-oriented quality gates.

**Decision:**

- `package.json` scripts -> `KEEP` as executable verification truth.
- `docs/standards/LOCAL-GUARDRAILS.md` -> `KEEP` + `INDEX` for local-development/verification tasks.
- `docs/standards/CI-GUARDRAILS.md` -> `KEEP` + `INDEX` for CI/PR/release tasks.
- Generic validation checklists should not cause full-suite execution after every intermediate edit; Sprint 5 verification tiers will define when each expensive gate is appropriate.

## Domain-Level Classification Baseline

| Domain / Source | Classification | Context Policy |
| --- | --- | --- |
| Current application source code | `KEEP` | Source of truth for implemented behavior; inspect only relevant files. |
| `config/guardrails.json` | `KEEP` | Canonical active-sprint configuration. |
| `package.json` scripts | `KEEP` | Canonical executable command/verification surface. |
| `database/prisma/schema.prisma` | `KEEP` | Canonical current Prisma schema. |
| `database/migrations/` | `KEEP` | Canonical migration history; inspect only for schema/migration tasks. |
| `docs/architecture/` | `INDEX` | Load the relevant architecture document by subsystem; do not load the directory wholesale. |
| `docs/api/` | `INDEX` | Load only for API/contract work or affected cross-layer tasks. |
| `docs/security/` | `INDEX` | Load only the security topics relevant to the change. |
| `testing/` | `INDEX` | Load testing policy relevant to the affected verification tier. |
| `database/docs/` | `INDEX` | Load for database/schema/migration work. |
| `deployment/` | `INDEX` | Load for packaging/release/runtime deployment work. |
| `docs/GITHUB-WORKFLOW.md` | `INDEX` | Load for branch/PR/merge/repository workflow tasks, not routine feature implementation. |
| `docs/standards/010-golden-rules.md` | `MERGE` | Replace broad automatic loading with a short policy/router plus domain references. |
| `docs/standards/02-folder-map.md` | `RETIRE` | Old planned layout conflicts with current repository. |
| `docs/standards/07-member-ownership.md` | `MERGE` | Preserve useful approval workflow but remove stale folder assumptions. |
| Root `README.md` | `MERGE` | Refresh current status/scope and use primarily as human navigation. |
| Older broad project-scope documents | `MERGE` | Consolidate into one approved canonical scope source before persistent indexing. |
| Sprint history under older sprint folders | `INDEX` | Historical evidence only; never infer current implementation state from old sprint records. |
| Implementation artifacts/history | `INDEX` | Retrieve only when traceability/history is needed. |

## Proposed Canonical Knowledge Layers

The final repository-context system should organize knowledge into these layers instead of feeding all documentation into every task.

### Layer 1 - Always-cheap routing metadata

Keep extremely small:

- repository identity;
- current sprint pointer;
- subsystem names;
- source-of-truth paths;
- context freshness state;
- task-to-domain routing hints.

### Layer 2 - Stable subsystem knowledge

Load only the matching subsystem summary:

- frontend/storefront;
- backend/API;
- inventory and batch integrity;
- sales/POS;
- database/Prisma;
- forecasting/SARIMA;
- Electron/runtime;
- security/auth;
- testing/verification;
- deployment/release.

### Layer 3 - Current implementation evidence

Open current source files only after routing identifies likely paths. Do not cache full source files as permanent model context.

### Layer 4 - Exception discovery

Widen repository inspection only when:

- indexed paths no longer exist;
- current source contradicts cached context;
- a test/build error reveals an undocumented dependency;
- the requested task crosses an undocumented subsystem;
- cached knowledge is stale or insufficient to explain observed behavior.

## Token-Efficiency Consequences

The audit already identifies several high-value savings opportunities:

1. Do not load both current and stale folder maps.
2. Do not load both ownership documents when one canonical source can cover the rules.
3. Do not load the entire Golden Rules document for every coding task.
4. Do not load API, security, testing, database, deployment, and forecasting guidance simultaneously unless the task genuinely crosses those domains.
5. Do not use the root README as a substitute for current implementation discovery.
6. Use executable scripts/configuration as compact truth where they already encode deterministic behavior.
7. Keep historical sprint and implementation records out of normal feature-task context.

## Open Conflicts Requiring Consolidation

| Conflict | Required Resolution |
| --- | --- |
| Current repo layout vs old `app/*` planned layout | Adopt current repository paths in one canonical repository map. |
| Current storefront implementation vs older broad scope exclusions | Create one approved current project-scope source and mark superseded scope statements historical. |
| Duplicate ownership guidance | Merge into one current ownership source. |
| Golden Rules vs specialized standards | Reduce Golden Rules to cross-cutting rules and references. |
| Root README status vs current sprint/repository state | Refresh README and remove stale implementation-status claims. |
| Generic full-validation expectations vs token-efficient development workflow | Define risk-based verification tiers in S5-08. |

## S5-01 Completion Criteria

S5-01 is complete when:

- all major guidance directories have an explicit context policy;
- known contradictions are documented;
- canonical candidates are identified;
- stale sources are excluded from automatic context;
- duplicate cross-cutting rules have a consolidation target;
- no document is deleted solely to reduce tokens;
- unresolved scope or product conflicts are explicitly flagged rather than guessed.

## Current Status

**In Progress.**

This baseline covers the primary architecture, standards, API, security, testing, database-guidance, root README, package-script, and sprint-governance surfaces. The next audit pass should validate remaining configuration, deployment, implementation-artifact, and forecasting guidance before S5-01 is marked complete.
