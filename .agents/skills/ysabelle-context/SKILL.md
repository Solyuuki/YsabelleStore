---
name: ysabelle-context
description: Use when working on implementation, debugging, review, refactoring, testing, architecture, database, inventory, POS, storefront, forecasting, Electron, security, or repository-governance tasks inside YsabelleStore.
---

# Ysabelle Context

Use persistent repository context as a navigation cache. Treat current source code, schema, migrations, tests, executable configuration, and approved current guidance as authoritative when cached context disagrees.

## Workflow

1. Convert the request into a short internal acceptance checklist. Preserve every explicit requirement and avoid unrelated scope.
2. Retrieve task context before exploratory scanning. Prefer MCP `find_relevant_context`; otherwise run `npm run repo:context:query -- "<task>" --json`.
3. Task retrieval checks Git freshness automatically. Mapped changes refresh incrementally; unmapped changes safely fall back to a full context refresh. Use `changed_since_index` or `repo:context:status` only when a diagnostic freshness report is useful.
4. Start with returned **primary files**, subsystem invariants, and required guidance. Inspect **secondary files** only when the task or current evidence requires them.
5. Read only current source needed to confirm and implement behavior. Follow direct imports/callers when necessary; do not reread understood files without new evidence.
6. Implement the smallest complete solution that satisfies the acceptance checklist and relevant invariants.
7. Verify according to the returned risk tier. Fix failures caused by the change without asking whether to continue.
8. Recheck the original acceptance checklist and stop when requirements are met and appropriate verification passes.
9. Report only the useful outcome, fresh verification evidence, remaining external blocker/risk, and meaningful context deviation.

## Discovery Escalation

Do not start routine work with a repository-wide scan. Widen discovery only when persistent context is missing, contradictory, points to a missing path, a failure exposes an undocumented dependency, the task crosses an unmodeled subsystem, or refreshed context is still insufficient.

Escalate in this order: primary files -> secondary/direct dependency neighborhood -> affected subsystem -> repository-wide discovery as last resort.

When cached context disagrees with current source, record it with MCP `report_context_mismatch` when available. Never force source code to match stale cache.

## Token and Repetition Rules

- Reuse persistent context across conversations instead of rediscovering stable architecture.
- Prefer targeted paths/searches over recursive repository dumps.
- Prefer concise command summaries over large successful logs.
- Do not rerun a successful expensive check unless relevant code changed afterward or evidence requires it.
- Do not regenerate the same plan repeatedly within one task.
- Do not perform unrelated refactors or speculative cleanup.
- Do not load historical sprint artifacts and every domain guide together unless the task genuinely crosses those areas.
- Use deterministic Git freshness/change scripts instead of model reasoning over giant diffs.
- Do not run `repo:context:build` at the start of routine tasks; retrieval auto-builds only when no persistent store exists.

## Continuation Policy

Proceed through normal reversible inspection, implementation, targeted fixes, and verification without asking "Do you want me to continue?"

Ask only when required behavior cannot be safely inferred, credentials/secrets are required, the next action is destructive or irreversible, an external side effect needs authorization, or materially different implementations create different required product behavior.

A discovered relevant file, a failing test caused by the current change, or the need to continue to the next normal implementation step is not a blocker.

## Verification Tiers

- **Tier 1 - Local:** targeted test/component check plus affected typecheck/lint/build when applicable.
- **Tier 2 - Subsystem:** relevant test group, affected workspace build/typecheck, and integration/API checks.
- **Tier 3 - Full/high risk:** inventory/POS integrity, auth/security, database/schema, cross-cutting behavior, release/packaging, or similar high-risk changes. Run full required verification near completion after targeted checks are green.

Never weaken required final verification to save tokens. Optimize repeated discovery and redundant execution, not correctness.

## Completion Contract

Do not claim completion until requested behavior exists, no explicit requirement is omitted, relevant invariants hold, appropriate fresh checks pass or an external blocker is reported, no known introduced issue remains unresolved, UI work is coherent when checkable, and architecture/context is synchronized when its source-of-truth routing changed.
