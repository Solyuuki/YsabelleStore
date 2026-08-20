# Sprint 5 Definition of Done

Sprint 5 is complete only when the repository-context workflow demonstrates both efficiency and implementation quality improvements.

## Knowledge and Guidance

- Existing project guidance has been inventoried and classified.
- Authoritative sources are documented and obvious duplicates/conflicts are resolved or explicitly tracked.
- Stable architecture/business knowledge is separated from change-sensitive implementation details.
- The context layer does not become a competing source of truth.

## Persistent Context

- A compact repository index exists and can be regenerated deterministically.
- The index records the repository state/commit used to generate it.
- Changed paths can be detected without a full model-driven repository scan.
- Incremental refresh updates affected context only when practical.
- Stored context can be reused by separate Codex conversations through the planned context interface.

## Codex Behavior

- The project-level Skill queries known context before broad exploration.
- Routine tasks begin with narrow inspection of likely affected files.
- Broad discovery occurs only when context is missing, stale, contradictory, or debugging evidence requires expansion.
- Codex does not ask unnecessary continuation questions during normal reversible implementation.
- Acceptance criteria are checked before completion.
- Unrelated refactoring is avoided.

## Verification

- Local, subsystem, and full verification tiers are documented.
- Intermediate edits use the least expensive sufficient verification tier.
- Passing expensive checks are not rerun without a relevant reason.
- Full verification remains available for release-sensitive, cross-cutting, security, database, and other high-risk changes.
- Context mismatches discovered during verification are reported and refreshable.

## Benchmark

- At least one baseline workflow and multiple optimized pilot tasks are measured.
- Results include token use where available, repeated scans/reads, command executions, clarification turns, retries, and requirement satisfaction.
- The optimized workflow shows meaningful reduction in avoidable repetition without introducing lower-quality or incomplete implementation.

## Safety Rule

If token-saving behavior conflicts with correctness, approved project requirements, data integrity, security, or required validation, correctness and project requirements take priority.
