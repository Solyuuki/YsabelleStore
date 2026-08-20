# YsabelleStore Repository Context

This directory implements the Sprint 5 persistent repository-context layer used by coding-agent workflows.

## Purpose

The context system keeps a compact reusable map of YsabelleStore instead of forcing every new coding conversation to rediscover the repository. It stores navigation metadata, subsystem relationships, business/architecture invariants, guidance pointers, task flows, and Git freshness state. It does **not** store full source-code copies as model context.

Current source code, Prisma schema, migrations, tests, and executable configuration remain authoritative.

## Generated Local State

The first context retrieval/build creates `.ysabelle-context/`, which is ignored by Git:

- `index.json` — compact subsystem/file metadata and flow map;
- `state.json` — indexed Git commit/branch and dirty-file hash snapshot;
- `mismatches.jsonl` — optional local context-deviation records.

This state persists across separate agent conversations that use the same checkout.

## Normal Workflow

Routine tasks do **not** need a manual full build or status/refresh sequence.

```bash
npm run repo:context:query -- "Fix POS stock deduction" --json
```

Retrieval automatically:

1. builds the persistent store if it does not exist;
2. checks Git freshness;
3. incrementally refreshes mapped changed subsystems;
4. safely performs a full refresh when changed paths cannot be mapped;
5. returns compact task context.

`status` remains a read-only diagnostic when you specifically want to inspect freshness:

```bash
npm run repo:context:status -- --json
```

Explicit build/refresh commands are still available for setup, recovery, troubleshooting, or controlled maintenance:

```bash
npm run repo:context:build
npm run repo:context:refresh -- --json
npm run repo:context:overview -- --json
npm run repo:context:benchmark -- "Fix POS stock deduction" --json
npm run repo:context:test
```

## Primary vs Secondary Files

Task context distinguishes:

- **primaryFiles** — implementation paths most likely to contain the behavior that must change;
- **secondaryFiles** — callers, UI surfaces, integration/cache dependencies, routes/controllers, docs, or adjacent paths that may need inspection;
- **likelyFiles** — ordered union of primary then secondary paths, capped to keep context small.

Open primary files first. Secondary paths are not mandatory reads; inspect them only when the requested behavior or evidence requires it.

## Benchmark

`benchmark` reports a deterministic context-footprint proxy plus routing counts such as primary/secondary files, guidance/invariant counts, related flows, and verification tier.

It is useful for comparing compact task context against the repository text footprint, but it is **not** actual Codex billing/usage telemetry. Actual tokens-per-correct-task requires a compatible coding-agent host that exposes usage data.

## Codex Integration

The repository includes:

- `.agents/skills/ysabelle-context/` — project Skill for context-first, narrow, low-repetition coding behavior;
- `.codex/config.toml` — project-scoped MCP configuration for trusted Codex checkouts;
- `tools/repo-context/mcp-server.mjs` — local STDIO MCP server.

When the project is trusted and opened from the repository checkout, Codex can start the MCP server with Node. If a client does not load project MCP configuration, register the same command manually from the repository root:

```bash
codex mcp add ysabelle-repo-context -- node tools/repo-context/mcp-server.mjs
```

Restart the host after first adding/changing MCP or Skill configuration if it does not refresh automatically.

## MCP Tools

- `repo_overview` — fresh compact subsystem/flow overview;
- `find_relevant_context` — auto-refresh and route a task to primary/secondary files, guidance, invariants, and verification tier;
- `get_subsystem` — fresh stored context for one subsystem;
- `trace_flow` — fresh stored cross-layer flow;
- `changed_since_index` — diagnostic Git changes since the snapshot, without refreshing it;
- `refresh_context` — explicit changed/selected context refresh;
- `report_context_mismatch` — record when cached context disagrees with current implementation.

## Escalation Rule

Normal path:

```text
query task context
  -> auto freshness/refresh
  -> open primary current files
  -> secondary dependencies only if needed
  -> implement
  -> targeted verification
  -> final verification tier
```

Widen discovery only when context is missing, contradictory, a path moved, a failure exposes an undocumented dependency, or the task crosses an unmodeled subsystem. Repository-wide scans are a last resort.

## Canonical Configuration

`config/repository-context.json` is the committed routing/source map. When architecture, major paths, or scope routing changes, update that config together with the authoritative project guidance rather than teaching the cache through repeated chat instructions.
