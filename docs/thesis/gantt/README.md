# YsabelleStore Thesis Gantt — Sprint / Implementation / Evidence

> Evidence-first **draft**, not an approved project completion report. This is a documentation-only artifact in `m1/v0.13/docs/thesis-gantt-evidence`, based on the pre-existing `sprint/v0.13/sprint-13` history at `53b29e23f80864f539a43f91c02e42b80659ca21`. No application code or canonical data is modified.

## Requested hierarchy

```text
Sprint 01-13
  └── Implementation / work item
        ├── Scope and owner (from sprint backlog or member assignments)
        ├── Observed activity date(s) (from commit timestamps)
        ├── Evidence
        │     ├── Commit SHA and clickable link
        │     ├── Relevant changed files and PR links (when verified)
        │     └── CI / manual QA references (only when verified)
        └── Status and start/end-date confidence
```

## Key rule

A commit is **evidence that a change was recorded**, not automatic proof that a whole sprint, task, QA gate, production deployment or release is complete. A branch-head commit is a **checkpoint**, not necessarily the sprint's end date. Preserve the distinction between planned, implemented, verified and accepted work.

## Contents

- [Implementation Evidence Register](IMPLEMENTATION-EVIDENCE.md): implementations nested under Sprints 1–13 with individual commit links and evidence types.
- [Initial Gantt View](GANTT-MILESTONES.md): Mermaid chart of **dated, source-backed milestones only**. Task-duration bars are intentionally absent until beginning/end boundaries can be supported.
- Existing planning sources: [Sprints](../../sprints/), [M1 artifacts](../../implementation-artifacts/m1-abarado/), [M2 artifacts](../../implementation-artifacts/m2-ramos/), [M3 artifacts](../../implementation-artifacts/m3-vito/).

## Process for a full defense-ready duration chart

1. Read each sprint's README, backlog, owner assignments, progress, task register and Definition of Done.
2. Split meaningful implementation tasks; attach their exact code-change commits and paths.
3. Use the earliest/last confirmed **task-related** commit dates as observed activity bounds, never as asserted planned start/end dates or work hours.
4. Cross-check merges, PRs, testing evidence and acceptance. If incomplete, mark **unverified**.
5. Produce the final Gantt bars from documented schedule dates or explicitly labeled inferred activity windows. Avoid claiming precision unavailable in Git.

## Initial scope

- Repo: [Solyuuki/YsabelleStore](https://github.com/Solyuuki/YsabelleStore)
- Sprint documentation: 1–13
- Git history observed: 2026-06-24 to 2026-10-31 (activity within **five calendar months**)
- Status: **foundation / first-pass evidence index**; not a full 5,341-commit audit.
- No PR, merge, deployment or database mutation is made here.
