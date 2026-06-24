# Merge Collisions

This is the primary conflict-prevention guide for the three-member YsabelleStore team. Follow it before every branch, commit, push, PR, and merge.

## Required Stages

| Stage         | Action                                                                              |
| ------------- | ----------------------------------------------------------------------------------- |
| Before Branch | Pull latest `main` and confirm no local unfinished work conflicts with the new task |
| Before Coding | Confirm task owner, affected files, and branch name                                 |
| Before Commit | Review changed files and remove unrelated edits                                     |
| Before Push   | Pull/rebase latest `main` when appropriate and run available checks                 |
| Before PR     | Document affected files, tests, and ownership                                       |
| Before Merge  | Confirm checks pass, review is complete, and conflicts are resolved                 |

## Conflict Prevention Rules

| Rule                          | Requirement                                                |
| ----------------------------- | ---------------------------------------------------------- |
| Pull Latest Main              | Start branches from the newest `main`                      |
| Feature Branches Only         | Never code directly on `main`                              |
| Small PR Rule                 | Keep PRs focused on one task                               |
| Ownership Validation          | Do not edit another member's files without approval        |
| Affected Files Documentation  | List touched files in PR and member artifact               |
| Review Requirement            | At least one appropriate reviewer must approve             |
| Conflict Resolution Procedure | Resolve with owner involvement and document final decision |

## Process Flow

```text
Need a change
  -> Check owner
  -> Pull main
  -> Create valid branch
  -> Edit focused files
  -> Run validation
  -> Open PR with affected files
  -> Resolve comments
  -> Merge after green checks
```

## Conflict Escalation Flow

| Level   | Trigger                                       | Action                                            |
| ------- | --------------------------------------------- | ------------------------------------------------- |
| Level 1 | Conflict only in assigned files               | Assigned member resolves and documents            |
| Level 2 | Conflict touches another member's files       | Pause and request owner review                    |
| Level 3 | Conflict changes schema/API/forecast contract | Team review required before merge                 |
| Level 4 | Conflict blocks sprint work                   | Record blocker and decide task priority as a team |

## Good vs Bad Examples

| Good Example                                                              | Bad Example                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Pull `main`, create `m2/v0.3/feat/inventory-api`, edit backend files only | Work on `main` and push directly                     |
| Split UI and API changes into separate PRs when possible                  | Bundle UI redesign, API changes, and migration fixes |
| Ask m2 before editing `schema.prisma`                                     | Edit migration files without owner approval          |
| Document affected files in PR                                             | Submit PR with no test notes                         |

## PR Checklist

- [ ] Branch name is valid
- [ ] PR scope matches one task
- [ ] Affected files are listed
- [ ] Ownership approvals are complete
- [ ] Build/lint/tests were run when available
- [ ] No generated or unrelated files are included
- [ ] Conflict resolution notes are included when conflicts occurred

## Merge Checklist

- [ ] PR is approved
- [ ] GitHub Actions checks pass
- [ ] Branch has no unresolved conflicts
- [ ] Task artifact is updated
- [ ] Reviewer confirms ownership rules were followed
- [ ] Merge method is agreed by team

## Resolution Procedure

| Step | Action                                    |
| ---- | ----------------------------------------- |
| 1    | Identify conflicted files                 |
| 2    | Identify file owners                      |
| 3    | Preserve both valid changes when possible |
| 4    | Run related tests or validation           |
| 5    | Document final decision in PR             |
| 6    | Request re-review before merge            |
