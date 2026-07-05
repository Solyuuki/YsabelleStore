# Repository Agent Rules

## Mandatory Sprint Artifact Tracking

Every implementation task must update the matching Sprint 2 documentation and member implementation artifacts.

Required documentation targets:

| Target                                                       | Purpose                             |
| ------------------------------------------------------------ | ----------------------------------- |
| `docs/sprints/sprint-2/members/<member>.md`                  | Member-specific sprint tracking     |
| `docs/sprints/sprint-2/SPRINT-BACKLOG.md`                    | Sprint backlog traceability         |
| `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`                | Ownership tracking                  |
| `docs/implementation-artifacts/<member>/TASKS.md`            | Member task list                    |
| `docs/implementation-artifacts/<member>/SPRINT-PROGRESS.md`  | Progress history                    |
| `docs/implementation-artifacts/<member>/TESTING-REPORTS.md`  | Validation evidence                 |
| `docs/implementation-artifacts/<member>/BLOCKERS.md`         | Blocker history if present          |
| `docs/implementation-artifacts/<member>/DECISIONS.md`        | Decision history if present         |
| `docs/implementation-artifacts/<member>/DEPLOYMENT-NOTES.md` | Deployment/setup changes if present |

Use real work evidence only.

Do not invent tasks.
Do not invent validation results.
Do not invent timestamps.
Do not mark validation as passed unless the command was actually run and passed.

If unsure, write:

- Pending validation
- Needs review
- Unclassified change

## Timestamp Rule

Documentation timestamps must be based on actual local date/time or actual git commit date.

Do not write fake dates.
Do not write fake completion times.
Do not backdate logs.

## Required Workflow

For M1:

```sh
git add .
npm run sprint:ready -- --member=m1
git add .
git commit -m "feat: update sprint 2 work"
git push
```

For M2:

```sh
git add .
npm run sprint:ready -- --member=m2
git add .
git commit -m "feat: update sprint 2 work"
git push
```

For M3:

```sh
git add .
npm run sprint:ready -- --member=m3
git add .
git commit -m "test: update sprint 2 validation work"
git push
```

The second git add . is required because sprint:ready may generate or update .md artifact files.

Generated logs must be reviewed before push.

If the generated log is too vague, update the .md files manually with accurate details.
