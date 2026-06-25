# Daily Workflow

Sprint 1 uses a repeatable daily flow so every member starts from the sprint branch and returns changes through pull requests.

## Developer Flow

```text
Developer
|
v
Pull sprint branch
|
v
Create member branch
|
v
Implement assigned task
|
v
Local validation
|
v
Push
|
v
Pull request
|
v
Review
|
v
Merge to sprint branch
|
v
Sprint review
|
v
Merge to staging
|
v
Release validation
|
v
Merge to main
```

## Daily Start

| Step | Command or Action                               | Purpose                              |
| ---- | ----------------------------------------------- | ------------------------------------ |
| 1    | `git checkout sprint/v0.1/sprint-1`             | Start from sprint integration branch |
| 2    | `git pull origin sprint/v0.1/sprint-1`          | Sync latest sprint work              |
| 3    | `git checkout -b member/version/type/task-name` | Create focused member branch         |
| 4    | Confirm task ID                                 | Match work to Sprint 1 backlog       |

## Daily Finish

| Step | Command or Action                   | Purpose                           |
| ---- | ----------------------------------- | --------------------------------- |
| 1    | Run local validation                | Catch issues before PR            |
| 2    | Push member branch                  | Publish task work                 |
| 3    | Open PR into `sprint/v0.1/sprint-1` | Request sprint integration review |
| 4    | Record validation evidence          | Support reviewer decision         |
| 5    | Address review comments             | Finish task safely                |

## Local Validation

```bash
npm run format
npm run format:check
npm run lint
npm run build
npm audit --audit-level=high
npx prisma validate --schema=database/prisma/schema.prisma
```

## Review Expectations

| Review Area   | Requirement                             |
| ------------- | --------------------------------------- |
| Scope         | PR matches one backlog task             |
| Ownership     | Affected owners approve shared files    |
| Validation    | Required command results are reported   |
| Stability     | No unrelated changes are included       |
| Documentation | Infrastructure decisions are documented |
