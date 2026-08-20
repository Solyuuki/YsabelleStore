# Sprint 5 Pilot and Benchmark Evidence

## Measurement Boundary

Sprint 5 separates two kinds of evidence:

1. **Repository-context proxy metrics** — deterministic and available without a coding-agent host.
2. **Actual model/agent usage metrics** — tokens, model iterations, repeated tool reads, correction loops, and acceptance success from a compatible Codex/coding-agent host.

Proxy results must never be presented as actual Codex billing.

## Baseline Evidence from the Sprint 5 Checkout

A user-run local benchmark on the Sprint 5 branch before final primary/secondary tuning used:

```text
Fix POS stock deduction after a completed sale
```

The context engine routed the task to `inventory` + `pos-sales`, returned eight likely files, selected verification Tier 3, and required no broad-discovery escalation. The deterministic compact-context estimate was approximately 497 tokens versus approximately 2.23 million tokens for the repository-text proxy, with a reported reduction ratio of 0.9998.

That measurement proves the routing/context-footprint mechanism; it does not prove equivalent savings in actual model usage because a real agent may still open source files, run tools, retry, or expand context.

## Finalized Routing Pilot Expectations

The final Sprint 5 routing model adds explicit **primary** and **secondary** files and automatic freshness handling.

| Pilot | Expected Routing | File Budget | Verification | Escalation |
| --- | --- | --- | --- | --- |
| Storefront global-search behavior | Storefront/frontend search flow | <= 8 likely files; primary search/service paths first | Tier 2 | No broad scan when mapped context is sufficient |
| POS stock deduction after completed sale | `inventory` + `pos-sales` | 3 primary implementation/data-integrity paths, then secondary route/UI/cache dependencies | Tier 3 | No broad scan when mapped context is sufficient |
| Authentication role + persisted session/database behavior | auth/database/security-related flow | <= 8 likely files with backend authorization/service paths prioritized | Tier 3 | No broad scan when mapped context is sufficient |

## Freshness Acceptance Evidence

Focused regression coverage verifies these state transitions:

```text
unchanged checkout
  -> reuse persisted index

mapped source change
  -> stale = true
  -> affected subsystem identified
  -> incremental refresh
  -> stale = false

unmapped/cross-cutting change
  -> stale = true
  -> requiresFullRefresh = true
  -> safe full context refresh

routine task retrieval
  -> automatic freshness check/refresh
  -> context returned
```

`status` remains diagnostic and does not mutate context. Retrieval commands and MCP context tools perform the freshness step so normal tasks do not require a manual `build -> status -> refresh -> query` sequence.

## Token-Efficiency Success Criteria

The repository-side implementation is considered successful when representative tasks:

- return a small relevant subsystem set;
- return no more than the configured likely-file budget;
- prioritize implementation paths over adjacent dependencies;
- avoid broad discovery when context is sufficient;
- use incremental refresh for mapped changes;
- fall back safely when freshness cannot be established narrowly;
- preserve the verification tier required by risk.

The optimization target remains **tokens per correctly completed task**, not minimum tokens per message.

## Live Host Validation Still Required

The following cannot be truthfully completed without a compatible coding-agent host that exposes its behavior/usage:

- actual tokens per completed task;
- model/agent iteration count;
- repeated file/tool reads performed by the host;
- clarification/continuation turns caused by host behavior;
- live Codex loading of the project Skill and `.codex/config.toml` MCP registration;
- real implementation retry/correction rate before vs after Sprint 5.

When a compatible host becomes available, rerun the three representative pilots and record actual usage beside the proxy results rather than replacing them.

## Live Pilot Checklist

For each real coding task record:

- task and acceptance criteria;
- context query result and refresh mode;
- primary files opened;
- secondary files opened;
- any discovery escalation;
- verification tier and commands actually run;
- actual token/usage data when exposed by the host;
- retries/corrections;
- whether all acceptance criteria were satisfied;
- regressions or unresolved issues.
