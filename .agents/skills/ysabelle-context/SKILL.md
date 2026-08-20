---
name: ysabelle-context
description: Use for implementation, debugging, review, refactoring, testing, architecture, database, inventory, POS, storefront, forecasting, Electron, security, or repository-governance work inside YsabelleStore. Reuse persistent repository context before exploratory scanning, refresh only changed or contradictory areas, inspect the smallest current source set needed, preserve business invariants, avoid repeated reads and verification loops, continue normal reversible work without asking permission, and verify the user's acceptance criteria before completion. Prefer the Ysabelle repository-context MCP tools when connected; otherwise use the repo:context npm commands.
---

# Ysabelle Context

Use persistent repository knowledge as a navigation cache. Treat current source code, schema, migrations, executable configuration, and approved current guidance as authoritative when cached context disagrees.

## Workflow

1. Convert the request into a short internal acceptance checklist. Preserve every explicit requirement and avoid unrelated scope.
2. Check persistent context before broad discovery. Prefer MCP `changed_since_index`; otherwise run `npm run repo:context:status -- --json`.
3. If stale, refresh before implementation. Prefer MCP `refresh_context`; otherwise run `npm run repo:context:refresh -- --json`. Refresh affected subsystems unless the status requires a full refresh.
4. Retrieve task context. Prefer MCP `find_relevant_context`; otherwise run `npm run repo:context:query -- "<task>" --json`.
5. Start from the returned subsystems, likely files, guidance, invariants, flows, and verification tier.
6. Read only current source needed to confirm and implement behavior. Follow direct imports/callers when necessary; do not reread understood files without new evidence.
7. Implement the smallest complete solution that satisfies the acceptance checklist and relevant invariants.
8. Verify according to risk. Fix failures caused by the change without asking whether to continue.
9. Recheck the original acceptance checklist and stop when requirements are met and appropriate verification passes.
10. Report only the useful outcome, verification, remaining blocker/risk, and meaningful context deviation.

## Discovery Escalation

Do not start routine work with a repository-wide scan. Widen discovery only when persistent context is missing, stale, contradictory, points to a missing path, a failure exposes an undocumented dependency, the task crosses an unmodeled subsystem, or the failure cannot be explained from the known subsystem.

Escalate in this order: likely files -> direct dependency/caller neighborhood -> affected subsystem -> repository-wide discovery as last resort.

When cached context disagrees with current source, record it with MCP `report_context_mismatch` when available. Never force source code to match stale cache.

## Token and Repetition Rules

- Reuse persistent context across conversations instead of rediscovering stable architecture.
- Prefer targeted paths/searches over recursive repository dumps.
- Prefer concise command summaries over large successful logs.
- Do not rerun a successful expensive check unless relevant code changed afterward or evidence requires it.
- Do not regenerate the same plan repeatedly within one task.
- Do not perform unrelated refactors or speculative cleanup.
- Do not load historical sprint artifacts and every domain guide together unless the task genuinely crosses those areas.
- Use deterministic freshness/change scripts instead of model reasoning over giant diffs.

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

Do not claim completion until requested behavior exists, no explicit requirement is omitted, relevant invariants hold, appropriate checks pass or an external blocker is reported, no known introduced issue remains unresolved, UI work is coherent when checkable, and the final response stays concise.
