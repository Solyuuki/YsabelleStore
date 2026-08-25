# Sprint 5 Goal

## Goal

Create a token-efficient, context-aware Codex workflow for YsabelleStore that reuses stable repository knowledge across tasks and conversations, avoids unnecessary repeated discovery and verification, and still completes requested work correctly against explicit acceptance criteria.

## Required Outcomes

- Existing guidance is preserved, audited, and reorganized instead of blindly replaced.
- Stable repository knowledge can be reused without rescanning the entire project for every task.
- Changed or uncertain areas are refreshed incrementally.
- Codex uses narrow, evidence-driven inspection by default.
- Normal reversible implementation work continues without unnecessary "do you want me to continue?" confirmation loops.
- Verification effort is proportional to change risk.
- The system reports when stored context was stale or insufficient.
- Source code and approved project guidance remain authoritative over cached context.
- Token reduction never justifies incomplete, incorrect, or low-quality implementation.

## Operating Principle

> Minimize repeated discovery, not necessary reasoning. Minimize redundant context, not correctness. Optimize for tokens per correctly completed task.

## Non-Goals

- Do not copy the entire repository into a Skill or prompt.
- Do not modify Codex system-managed Skills under `.codex/skills/.system`.
- Do not suppress investigation when evidence indicates the cached context is stale or incomplete.
- Do not weaken required security, database, inventory, forecasting, or release validation merely to reduce token usage.
