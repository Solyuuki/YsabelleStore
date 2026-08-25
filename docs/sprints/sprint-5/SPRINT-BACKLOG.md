# Sprint 5 Backlog

## Sprint Theme

Reduce repeated coding-agent repository discovery and unnecessary loops while preserving or improving requirement satisfaction, implementation quality, and verification discipline.

## Work Items

| ID    | Work Item                          | Outcome                                                                                  | Status                                                      |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| S5-01 | Guidance and source-of-truth audit | Consolidate current scope/layout/ownership/execution guidance and retire stale routing   | **Completed**                                               |
| S5-02 | Canonical repository knowledge map | Record authoritative architecture, subsystem, guidance, test, and verification locations | **Implemented**                                             |
| S5-03 | Stable vs dynamic context model    | Separate reusable architecture/invariants from change-sensitive implementation details   | **Implemented**                                             |
| S5-04 | Persistent repository index        | Store compact cross-task repository knowledge without duplicating full source code       | **Implemented**                                             |
| S5-05 | Git freshness tracking             | Detect changes since the last indexed state and identify affected paths/subsystems       | **Implemented**                                             |
| S5-06 | Incremental context refresh        | Refresh mapped changed areas and safely fall back when narrow refresh is unsafe          | **Implemented**                                             |
| S5-07 | `ysabelle-context` project Skill   | Enforce context-first, narrow, low-repetition implementation behavior                    | **Implemented**                                             |
| S5-08 | Verification tiers                 | Define local, subsystem, and full verification levels based on risk                      | **Implemented**                                             |
| S5-09 | MCP repository-context service     | Expose persistent repository knowledge to separate coding-agent conversations            | **Implemented; live Codex-host validation pending**         |
| S5-10 | Context deviation reporting        | Record stale/mismatched cached knowledge without overriding current source               | **Implemented**                                             |
| S5-11 | Benchmark harness and baseline     | Deterministic context-footprint/routing benchmark with explicit non-billing boundary     | **Repo-side complete; actual host usage telemetry pending** |
| S5-12 | Pilot tasks                        | Representative storefront, POS/inventory, auth/database routing/freshness pilots         | **Repo-side complete; live coding-agent pilots pending**    |
| S5-13 | Final tuning                       | Consolidate guidance, auto-refresh retrieval, prioritize primary vs secondary files      | **Completed**                                               |

## Repository-Side Completion Summary

Sprint 5 now provides:

- one canonical current project-scope source (`docs/PROJECT-SCOPE.md`);
- current repository-layout and ownership routing;
- a compact Golden Rules policy/router instead of a large duplicated instruction dump;
- a committed task/subsystem/source map in `config/repository-context.json`;
- local persistent `.ysabelle-context/` state that survives separate sessions in the same checkout;
- Git-based freshness detection;
- incremental refresh for mapped changes and full-refresh fallback for unmapped changes;
- automatic freshness handling during normal CLI/MCP context retrieval;
- primary implementation files separated from secondary dependencies;
- a lean project Skill and project-scoped MCP configuration;
- context mismatch reporting;
- risk-based verification tiers;
- deterministic benchmark/proxy reporting;
- regression coverage integrated with `npm run verify:code`.

## Verification Evidence

Focused implementation validation exercised:

- persistent-index reuse without rebuild;
- mapped change -> stale -> affected subsystem -> incremental refresh -> fresh;
- unmapped change -> safe full-refresh fallback;
- MCP task retrieval with automatic refresh;
- CLI task retrieval with automatic refresh while `status` remains diagnostic;
- primary/secondary file ordering;
- existing repository-context tests;
- existing guardrail regression tests.

The repository-context and guardrail suites pass in the available isolated repository snapshot used for Sprint 5 verification. Full `verify:code` could not be executed in that isolated environment because third-party Node dependencies were not installed and network installation was unavailable; this is an environment limitation rather than a passing full-suite claim.

## Benchmark Boundary

`repo:context:benchmark` intentionally reports a deterministic **context-footprint proxy**, not actual model billing. See [`PILOT-BENCHMARKS.md`](PILOT-BENCHMARKS.md).

Actual tokens per correctly completed task, live model iterations, repeated host file/tool reads, and live Codex Skill/MCP loading remain external-host validation items.

## Remaining External Validation

No additional repository implementation is required merely to wait for Codex. When a compatible coding-agent host becomes available:

1. open/trust the Sprint 5 checkout;
2. confirm the `ysabelle-context` Skill and `ysabelle-repo-context` MCP service load;
3. run the three representative pilot tasks;
4. record actual host token/iteration/retry metrics beside the existing deterministic proxy;
5. tune only if live evidence shows a meaningful routing/verification problem.

## Anti-Waste Requirements

The optimized workflow avoids, unless evidence requires otherwise:

- repository-wide scans at the start of routine tasks;
- rereading already-understood files in the same task;
- repeatedly regenerating the same plan;
- repeated full builds/audits after every intermediate edit;
- rerunning successful expensive checks without a relevant change;
- dumping large successful command output into model context;
- unnecessary continuation confirmations for normal reversible work;
- unrelated refactoring outside the requested acceptance criteria.

The primary optimization target remains **tokens per correctly completed task**. Correctness, data integrity, security, and required validation take priority over token reduction.

## Sprint Activity Log

| Date       | Member     | Work Item                                                                                                        | Status | Evidence                     |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------- |
| 2026-08-24 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed | electron/src/config/paths.ts |
