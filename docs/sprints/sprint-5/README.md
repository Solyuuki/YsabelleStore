# Sprint 5 Planning Index

Sprint 5 implements a token-efficient, context-aware coding-agent workflow for YsabelleStore while preserving correctness, repository source-of-truth discipline, and risk-appropriate verification.

## Sprint Metadata

| Field                     | Details                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Sprint                    | Sprint 5                                                                           |
| Sprint branch             | `sprint/v0.5/sprint-5`                                                             |
| Active sprint source      | `config/guardrails.json`                                                           |
| Primary theme             | Persistent repository context + low-repetition implementation workflow             |
| Primary efficiency metric | Tokens per correctly completed task                                                |
| Quality rule              | Token savings never override required behavior, integrity, security, or validation |
| Repository-side status    | Implementation complete; live Codex-host empirical validation pending              |

## What Sprint 5 Added

- canonical current scope/layout/ownership/execution sources;
- guidance consolidation that removes stale plans from active routing;
- persistent `.ysabelle-context/` repository memory;
- deterministic Git freshness tracking;
- incremental mapped refresh with safe full-refresh fallback;
- automatic freshness handling during normal context retrieval;
- primary vs secondary source-file prioritization;
- project-level `ysabelle-context` Skill;
- project-scoped repository-context MCP service;
- context mismatch reporting;
- local/subsystem/full verification tiers;
- deterministic routing/context-footprint benchmark tooling;
- regression coverage integrated into repository verification.

## Normal Task Flow

```text
new task / new conversation
        ↓
query persistent YsabelleStore context
        ↓
automatic Git freshness check
        ↓
refresh changed context only when safe
        ↓
primary implementation files
        ↓
secondary dependencies only if needed
        ↓
implement requested behavior
        ↓
targeted verification
        ↓
acceptance-criteria check
        ↓
final verification tier
        ↓
done
```

Repository-wide discovery is a last-resort escalation when refreshed context is missing, contradictory, or insufficient.

## Planning and Evidence Documents

| Document                                                               | Purpose                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md)                                       | Sprint outcome and operating principles                           |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md)                                 | Work-item implementation/status and remaining external validation |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md)                         | Repository-side vs live-host completion criteria                  |
| [REPOSITORY-CONTEXT-PLAN.md](REPOSITORY-CONTEXT-PLAN.md)               | Original technical design and rollout plan                        |
| [GUIDANCE-SOURCE-OF-TRUTH-AUDIT.md](GUIDANCE-SOURCE-OF-TRUTH-AUDIT.md) | Completed guidance consolidation/source-of-truth audit            |
| [PILOT-BENCHMARKS.md](PILOT-BENCHMARKS.md)                             | Proxy/pilot evidence and live-host measurement boundary           |
| [`../../PROJECT-SCOPE.md`](../../PROJECT-SCOPE.md)                     | Canonical current thesis/product scope classification             |

## Implementation Entry Points

```text
config/repository-context.json
.agents/skills/ysabelle-context/
.codex/config.toml
tools/repo-context/
```

Useful commands:

```bash
npm run repo:context:query -- "<task>" --json
npm run repo:context:status -- --json
npm run repo:context:benchmark -- "<task>" --json
npm run repo:context:test
```

A routine task should normally start with `query`, not a manual full build.

## Remaining External Evidence

The repository cannot manufacture actual Codex/model usage telemetry. When a compatible coding-agent host becomes available, validate fresh-session Skill/MCP loading and record actual tokens/iterations/retries for the representative pilots in `PILOT-BENCHMARKS.md`.

## Latest Sprint Activity

| Date       | Member     | Branch                             | Latest Activity                                                                                                  | Validation Status |
| ---------- | ---------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-08-24 | M1 Abarado | validation/sprint5-recovery-remote | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed            |
