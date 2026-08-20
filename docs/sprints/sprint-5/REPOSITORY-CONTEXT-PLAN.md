# Sprint 5 Repository Context and Codex Efficiency Plan

## Problem Statement

Routine Codex tasks currently risk consuming excessive tokens and time because repository structure, subsystem relationships, guidance, and verification knowledge may be rediscovered repeatedly across tasks and conversations. This can also produce repeated scans, repeated command output, unnecessary continuation prompts, and multiple implementation retries.

The target is not simply fewer tokens. The target is **fewer tokens per correctly completed task**, with fewer repeated actions and better requirement satisfaction.

## Design Principles

1. **Repository source is authoritative.** Cached/indexed context is a navigation layer, not a replacement for current code.
2. **Preserve useful guidance.** Existing rules and documentation are upgraded, deduplicated, and indexed rather than discarded.
3. **Reuse stable knowledge.** Architecture, subsystem responsibilities, invariants, and source-of-truth locations should not be rediscovered on every task.
4. **Refresh incrementally.** Use Git/file state to identify changed areas and refresh only affected knowledge when possible.
5. **Escalate discovery on evidence.** Broad scans are allowed when cached context is stale, missing, contradictory, or insufficient to explain a problem.
6. **Verification is risk-based.** Use targeted checks during implementation and full verification only when appropriate.
7. **No false economy.** Do not trade correctness, data integrity, security, or required behavior for token reduction.

## Phase 1 — Guidance and Source-of-Truth Audit

Inventory repository guidance and classify each item:

- **KEEP** — authoritative and useful in its current location.
- **INDEX** — keep the original source; persistent context points to it.
- **MERGE** — duplicate or overlapping guidance should be consolidated.
- **MOVE** — useful material belongs in a more appropriate reference/context location.
- **RETIRE** — obsolete or contradicted guidance should no longer drive implementation.

The audit should cover at minimum architecture, API, database/Prisma, security, testing, deployment, sprint guardrails, forecasting, inventory, POS, storefront/e-commerce, role/access behavior, and verification scripts.

The resulting map must identify one authoritative source or precedence rule for every critical constraint to avoid contradictory instructions across Skills, docs, guardrails, and cached context.

## Phase 2 — Compact Repository Knowledge Model

Build a small reusable model containing navigation and relationships rather than full source copies.

Recommended knowledge categories:

- repository/module map;
- subsystem responsibilities;
- task-to-likely-file routing;
- frontend ↔ API ↔ service ↔ database relationships;
- critical business invariants;
- database/model ownership and mutation paths;
- test locations and relevant verification commands;
- authoritative guidance pointers;
- cross-subsystem dependencies;
- known architecture boundaries.

Example conceptual entry:

```text
POS sale
- UI entry: <path>
- API entry: <path/route>
- service path: <path>
- inventory impact: <documented relationship>
- database writes: <models/tables>
- invariants: atomic sale/stock behavior, no invalid negative stock, auditability
- tests: <paths>
- authoritative guidance: <docs>
```

Avoid embedding large code excerpts unless a small stable signature or invariant is necessary.

## Phase 3 — Stable vs Dynamic Context

### Stable context

Examples:

- architecture principles;
- subsystem ownership;
- folder responsibilities;
- business invariants;
- API/response conventions;
- validation policy;
- source-of-truth locations.

Stable context should survive many tasks and conversations with infrequent refresh.

### Dynamic context

Examples:

- current implementation paths when refactors occur;
- recently changed functions/components;
- schema/migration changes;
- sprint progress/status;
- generated artifacts;
- current test failures.

Dynamic context must be tied to repository state and refreshed based on Git/file changes.

## Phase 4 — Persistent Repository Index

Introduce a project-local generated context store, for example:

```text
.ysabelle-context/
├── state.json
├── index.db or equivalent structured index
└── summaries/
```

The state should record at least:

- indexed commit/ref;
- generation timestamp;
- index/schema version;
- known subsystem summaries;
- hashes or equivalent freshness metadata where useful.

Generated data should be deterministic where practical and should be clearly distinguished from manually maintained authoritative guidance.

## Phase 5 — Freshness and Incremental Refresh

Before broad discovery, compare the indexed repository state with the current Git state.

Conceptual workflow:

```text
indexed commit
      ↓
current commit / working tree
      ↓
changed paths
      ↓
map changed paths → affected subsystems
      ↓
refresh affected context only
```

Do not ask the language model to reason through giant diffs when deterministic scripts can identify changed paths, hashes, file movement, or basic dependency metadata.

### Escalation conditions

Widen inspection only when one or more of these occurs:

- documented path no longer exists;
- implementation contradicts stored relationships;
- tests/build reveal an undocumented dependency;
- the task touches an undocumented subsystem;
- an error cannot be explained from known context;
- a cross-cutting change invalidates multiple subsystem summaries;
- index freshness cannot be established safely.

Even after escalation, prefer subsystem-level discovery before a repository-wide scan.

## Phase 6 — Lean Project-Level Codex Skill

Create a small project Skill at approximately:

```text
.agents/skills/ysabelle-context/
├── SKILL.md
├── agents/openai.yaml
└── references/ (only when needed)
```

The Skill should remain a control plane, not a knowledge dump.

Core behavior:

1. Query/reuse known repository context before exploratory scanning.
2. Translate the user request into compact acceptance criteria.
3. Identify the likely subsystem and authoritative guidance.
4. Inspect only the current files necessary to implement safely.
5. Reuse information learned within the task instead of rereading without cause.
6. Proceed through normal reversible implementation without asking whether to continue.
7. If a check fails due to the change, diagnose and fix it without requesting permission.
8. Use risk-based verification.
9. Compare the result with original acceptance criteria before claiming completion.
10. Stop when requirements are satisfied and appropriate verification passes.
11. Report any repository-context mismatch discovered during the task.

### Genuine blockers that may require clarification

Examples:

- required user-facing behavior cannot be safely inferred;
- credentials/secrets are required;
- destructive or irreversible action needs authorization;
- external side effects require explicit approval;
- materially different implementations would produce different required product behavior.

Routine implementation progress is not a blocker.

## Phase 7 — Verification Tiers

### Tier 1 — Local

For isolated, low-risk changes:

- affected typecheck/lint where applicable;
- targeted unit/component test;
- focused manual/automated behavior check.

### Tier 2 — Subsystem

For multi-file changes inside one subsystem:

- relevant test group;
- affected package build/typecheck;
- relevant API/integration checks;
- database validation when the subsystem requires it.

### Tier 3 — Full / High Risk

For cross-cutting, release-sensitive, security, authentication, database-schema, inventory-integrity, packaging, or other high-risk changes:

- full repository verification as defined by project scripts;
- relevant security audit;
- Prisma/schema checks;
- production builds/package checks where applicable.

Do not repeatedly rerun a successful expensive tier if no relevant code has changed since it passed.

## Phase 8 — MCP Persistent Context Layer

After the knowledge/index model is proven, expose it through a small MCP service so separate Codex conversations can retrieve the same persistent repository knowledge.

Candidate tools:

```text
repo_overview()
find_relevant_context(task)
get_subsystem(name)
trace_flow(from, to)
changed_since_index()
refresh_context(paths or subsystem)
report_context_mismatch(...)
```

The MCP service should return compact, task-relevant context rather than large dumps.

### Relationship between Skill and MCP

- **MCP/context service:** persistent storage, indexing, lookup, freshness, and cross-conversation reuse.
- **Skill:** operating policy that tells Codex when/how to use the context, inspect source, verify, escalate, and stop.

## Phase 9 — Context Deviation Report

When cached knowledge is found to be stale, record a concise report, for example:

```text
Context deviation detected
- stored expectation: inventory mutation handled by <old path>
- current implementation: <new path>
- discovery scope: inventory subsystem only
- action: context refreshed
- repository-wide scan: not required
```

This prevents silent drift and gives evidence for updating the persistent index.

## Phase 10 — Benchmark and Pilot

Establish representative baseline tasks from actual YsabelleStore work. Run the same or comparable tasks with the optimized workflow.

Recommended pilots:

1. focused frontend/UI task;
2. backend/inventory/POS task with business invariants;
3. cross-cutting task requiring a higher verification tier.

Measure:

- tokens per correctly completed task where usage data is available;
- files inspected;
- repeated reads;
- broad searches/scans;
- model/agent iterations;
- command count and duplicate command count;
- full verification runs;
- clarification/continuation turns;
- retries/corrections;
- acceptance-criteria success;
- regressions or unresolved issues.

## Acceptance Standard

The Sprint 5 context architecture is successful when Codex can begin a new conversation, retrieve enough persistent knowledge to navigate directly to likely relevant code, inspect only the current implementation needed for the task, implement and verify the requested result, and refresh broader context only when evidence shows that the stored knowledge is insufficient or stale.

The expected result is a measurable reduction in repeated discovery and unnecessary loops without a reduction in implementation quality.
