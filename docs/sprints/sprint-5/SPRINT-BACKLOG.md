# Sprint 5 Backlog

## Approved Sprint Theme

Reduce repeated Codex repository discovery and unnecessary agent loops while improving requirement satisfaction and implementation reliability.

## Work Items

| ID | Work Item | Outcome | Status |
| --- | --- | --- | --- |
| S5-01 | Guidance and source-of-truth audit | Classify existing guidance as KEEP, INDEX, MERGE, MOVE, or RETIRE | Planned |
| S5-02 | Canonical repository knowledge map | Record authoritative architecture, subsystem, guidance, test, and verification locations | Planned |
| S5-03 | Stable vs dynamic context model | Separate reusable architecture/invariants from change-sensitive implementation details | Planned |
| S5-04 | Persistent repository index | Store compact cross-task repository knowledge without duplicating full source code | Planned |
| S5-05 | Git freshness tracking | Detect changes since the last indexed state and identify affected paths/subsystems | Planned |
| S5-06 | Incremental context refresh | Refresh only changed, stale, or error-related areas instead of rescanning the repository | Planned |
| S5-07 | `ysabelle-context` Codex Skill | Enforce context-first navigation, narrow reads, auto-continuation, acceptance criteria, and stop rules | Planned |
| S5-08 | Verification tiers | Define local, subsystem, and full verification levels based on change risk | Planned |
| S5-09 | MCP repository-context service | Expose persistent repository knowledge to separate Codex conversations | Planned |
| S5-10 | Context deviation reporting | Report stale/mismatched cached knowledge and refresh affected context | Planned |
| S5-11 | Benchmark harness and baseline | Compare old vs optimized workflow using token and task-quality metrics | Planned |
| S5-12 | Pilot tasks | Validate the system using representative UI, backend/inventory, and cross-cutting tasks | Planned |
| S5-13 | Final tuning | Remove duplicate rules, tighten triggers, and refine retrieval/verification behavior from pilot evidence | Planned |

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
