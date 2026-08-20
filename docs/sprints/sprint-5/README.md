# Sprint 5 Planning Index

Sprint 5 focuses on reducing Codex token waste and repeated repository discovery while preserving or improving implementation quality. The sprint introduces a coherent repository-knowledge architecture that lets Codex reuse stable system knowledge across tasks and conversations, refresh only changed or uncertain areas, and verify work according to risk.

## Sprint Metadata

| Field | Details |
| --- | --- |
| Sprint | Sprint 5 |
| Sprint branch | `sprint/v0.5/sprint-5` |
| Active sprint config | `config/guardrails.json` = `5` |
| Primary theme | Token-efficient, context-aware Codex workflow |
| Quality rule | Token savings must never replace correctness or required behavior |
| Source of truth | Current repository source and approved project guidance |

## Sprint 5 Core Objectives

1. Audit existing repository guidance and identify authoritative sources, duplication, stale material, and overlapping rules.
2. Reorganize existing guidance into one coherent knowledge system without discarding useful constraints.
3. Build a compact repository context/index so Codex does not need to rediscover stable architecture on every task.
4. Add incremental freshness tracking so only changed or uncertain areas are refreshed.
5. Introduce a lean project-level Codex Skill that enforces context-first, narrow-inspection, low-repetition execution behavior.
6. Design an MCP-backed persistent context layer so repository knowledge can be reused across separate Codex conversations.
7. Define verification tiers to avoid repeatedly running expensive full-repository checks during intermediate edits.
8. Benchmark the new workflow using tokens per correctly completed task, retries, scans, command executions, and requirement satisfaction.

## Planned Architecture

```text
YsabelleStore
├── source code and approved project guidance
├── docs/sprints/sprint-5/
├── .agents/skills/
│   └── ysabelle-context/
│       └── SKILL.md
├── .ysabelle-context/
│   ├── persistent repository index
│   ├── freshness state
│   └── compact subsystem summaries
└── tools/repo-context/
    ├── indexer
    ├── incremental updater
    └── MCP context service
```

The persistent context is a navigation and knowledge cache, not a replacement for the repository. Source code remains authoritative when cached knowledge and implementation disagree.

## Execution Model

```text
New task / new conversation
        ↓
Query persistent YsabelleStore context
        ↓
Identify likely subsystem, files, invariants, and guidance
        ↓
Inspect only current relevant source files
        ↓
Implement the requested behavior
        ↓
Run targeted verification
        ↓
Check original acceptance criteria
        ↓
Run the appropriate final verification tier
        ↓
Complete the task and report meaningful context deviations
```

Repository-wide discovery is a fallback, not a default. It is allowed when stored knowledge is missing, stale, contradictory, or insufficient to explain an error.

## Planning Documents

| Document | Purpose |
| --- | --- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md) | Defines the Sprint 5 outcome and operating principles |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md) | Breaks the plan into implementation phases and measurable work items |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) | Defines completion and quality requirements |
| [REPOSITORY-CONTEXT-PLAN.md](REPOSITORY-CONTEXT-PLAN.md) | Technical design for persistent context, Skill behavior, MCP, refresh, and benchmarking |

## Success Metric

The primary efficiency metric is **tokens per correctly completed task**, not tokens per message or turn. A cheaper task that requires repeated corrections is considered worse than a slightly more expensive task that is completed correctly in one cycle.
