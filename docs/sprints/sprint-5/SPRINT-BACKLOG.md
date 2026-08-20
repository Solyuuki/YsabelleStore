# Sprint 5 Backlog

## Approved Sprint Theme

Reduce repeated Codex repository discovery and unnecessary agent loops while improving requirement satisfaction and implementation reliability.

## Work Items

| ID | Work Item | Outcome | Status |
| --- | --- | --- | --- |
| S5-01 | Guidance and source-of-truth audit | Classify existing guidance as KEEP, INDEX, MERGE, MOVE, or RETIRE | In Progress |
| S5-02 | Canonical repository knowledge map | Record authoritative architecture, subsystem, guidance, test, and verification locations | Implemented |
| S5-03 | Stable vs dynamic context model | Separate reusable architecture/invariants from change-sensitive implementation details | Implemented |
| S5-04 | Persistent repository index | Store compact cross-task repository knowledge without duplicating full source code | Implemented |
| S5-05 | Git freshness tracking | Detect changes since the last indexed state and identify affected paths/subsystems | Implemented |
| S5-06 | Incremental context refresh | Refresh only changed, stale, or error-related areas instead of rescanning the repository | Implemented |
| S5-07 | `ysabelle-context` Codex Skill | Enforce context-first navigation, narrow reads, auto-continuation, acceptance criteria, and stop rules | Implemented |
| S5-08 | Verification tiers | Define local, subsystem, and full verification levels based on change risk | Implemented |
| S5-09 | MCP repository-context service | Expose persistent repository knowledge to separate Codex conversations | Implemented; Codex-host validation pending |
| S5-10 | Context deviation reporting | Report stale/mismatched cached knowledge and refresh affected context | Implemented |
| S5-11 | Benchmark harness and baseline | Compare old vs optimized workflow using token and task-quality metrics | In Progress; context-footprint proxy implemented |
| S5-12 | Pilot tasks | Validate the system using representative UI, backend/inventory, and cross-cutting tasks | In Progress; routing/proxy pilots passed |
| S5-13 | Final tuning | Remove duplicate rules, tighten triggers, and refine retrieval/verification behavior from pilot evidence | Planned |

## Implementation Evidence

The first working repository-context implementation was added in commit `03057c3328fba74ba98f151e56d60d15d6d2730e`.

Implemented surfaces include:

- `config/repository-context.json` for canonical task-to-subsystem routing, invariants, guidance pointers, flows, and verification tiers;
- `.ysabelle-context/` as ignored generated persistent state for the local checkout;
- Git commit/working-tree freshness detection and changed-subsystem mapping;
- incremental context refresh with full refresh fallback for unmapped or unsafe changes;
- `.agents/skills/ysabelle-context/` for context-first, low-repetition Codex behavior;
- `.codex/config.toml` and `tools/repo-context/mcp-server.mjs` for project-scoped MCP access;
- CLI commands for build, status, overview, query, refresh, and benchmark;
- context mismatch reporting through the MCP runtime;
- repository-context regression tests integrated into `verify:code`.

Local implementation validation passed the repository-context test suite and the pre-existing guardrail regression suite before the implementation commit was prepared. The MCP server was also exercised through modern discovery, legacy initialization, task-context lookup, freshness, refresh, and mismatch-reporting paths. Full Codex-host integration remains unverified because no Codex host was available during this implementation session.

The benchmark command intentionally reports a deterministic **context-footprint proxy**, not actual Codex billing or model-iteration token usage. Actual tokens-per-correct-task measurement remains part of S5-11/S5-12 when a compatible coding-agent host is available.

## Implementation Order

1. Audit existing guidance and define sources of truth.
2. Build the compact repository map and stable/dynamic context model.
3. Implement persistent storage and Git-based freshness tracking.
4. Create the lean project-level Codex Skill.
5. Add incremental refresh and context-deviation behavior.
6. Introduce the MCP query layer for cross-conversation reuse.
7. Establish baseline and optimized measurements.
8. Run pilot tasks and tune based on evidence.

## Anti-Waste Requirements

The optimized workflow should avoid, unless evidence requires otherwise:

- repository-wide scans at the start of routine tasks;
- rereading already-understood files in the same task;
- repeatedly regenerating the same plan;
- repeated full builds/audits after every intermediate edit;
- rerunning successful expensive checks without a relevant change;
- dumping large successful command output into model context;
- unnecessary continuation confirmations for normal reversible work;
- unrelated refactoring outside the requested acceptance criteria.

## Benchmark Metrics

Record, where measurable:

- total tokens per correctly completed task;
- number of model/agent iterations;
- number of user clarification/continuation turns;
- files inspected and repeated file reads;
- repository-wide searches/scans;
- command executions and duplicate executions;
- full verification-suite runs;
- retries caused by incorrect/incomplete implementation;
- acceptance-criteria satisfaction;
- known regressions or unresolved implementation issues.
