# YsabelleStore Repository Context

This directory implements the Sprint 5 persistent repository-context layer used by Codex.

## Purpose

The context system keeps a compact, reusable map of YsabelleStore instead of forcing every new coding conversation to rediscover the repository. It stores navigation metadata, subsystem relationships, invariants, guidance pointers, and Git freshness state. It does **not** store full source-code copies as model context.

Current source code, Prisma schema, migrations, and executable configuration remain authoritative.

## Generated local state

The first context command creates `.ysabelle-context/`, which is ignored by Git:

- `index.json` — compact subsystem/file metadata and flow map;
- `state.json` — indexed Git commit/branch and dirty-file hash snapshot;
- `mismatches.jsonl` — optional local context-deviation reports.

This local generated state survives separate Codex conversations in the same checkout.

## Commands

```bash
npm run repo:context:build
npm run repo:context:status -- --json
npm run repo:context:overview -- --json
npm run repo:context:query -- "Fix POS stock deduction" --json
npm run repo:context:refresh -- --json
npm run repo:context:benchmark -- "Fix POS stock deduction" --json
npm run repo:context:test
```

`benchmark` reports a deterministic context-footprint proxy. It is useful for comparing how much compact task context is returned versus the repository's text footprint, but it is **not** actual Codex billing/usage telemetry.

## Codex integration

The repository includes:

- `.agents/skills/ysabelle-context/` — the project Skill that tells Codex to query context first, inspect narrowly, verify according to risk, and avoid unnecessary continuation prompts;
- `.codex/config.toml` — project-scoped MCP configuration for trusted Codex checkouts;
- `tools/repo-context/mcp-server.mjs` — the local STDIO MCP server.

When the project is trusted and opened from the repository checkout, Codex can start the MCP server with Node. If a client does not load project MCP configuration, run the repository from its root and register the same command manually:

```bash
codex mcp add ysabelle-repo-context -- node tools/repo-context/mcp-server.mjs
```

Restart Codex after first adding or changing MCP/Skill configuration if the host does not automatically refresh it.

## MCP tools

- `repo_overview` — compact subsystem/flow overview;
- `find_relevant_context` — route a task to likely files, guidance, invariants, and verification tier;
- `get_subsystem` — retrieve one subsystem map;
- `trace_flow` — retrieve one stored cross-layer flow;
- `changed_since_index` — detect repository changes since the context snapshot;
- `refresh_context` — refresh changed/selected context;
- `report_context_mismatch` — record when cached context disagrees with current implementation.

## Escalation rule

Normal path:

```text
status -> refresh changed context if needed -> query task context -> open likely current files -> implement -> targeted verification
```

Widen discovery only when context is missing, stale, contradictory, a path moved, a failure exposes an undocumented dependency, or the task crosses an unmodeled subsystem. Repository-wide scans are a last resort.
