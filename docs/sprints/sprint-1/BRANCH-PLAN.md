# Branch Plan

Sprint 1 uses a sprint integration branch and a staging pre-release branch. Member feature branches merge into the sprint branch, not directly into `main`.

## Branch Tree

```text
main
|
v
staging
|
v
sprint/v0.1/sprint-1
|
|-- m1/v0.1/feat/frontend-app-shell
|-- m2/v0.1/feat/backend-core
`-- m3/v0.1/feat/database-foundation
```

## Merge Flow

```text
Member branch
|
v
Pull request
|
v
Sprint branch
|
v
Sprint review
|
v
Staging
|
v
Release validation
|
v
Main
```

## Required Branches

| Branch                             | Purpose                                  | Owner        |
| ---------------------------------- | ---------------------------------------- | ------------ |
| `main`                             | Stable branch only                       | Sprint lead  |
| `staging`                          | Pre-release validation branch            | Sprint lead  |
| `sprint/v0.1/sprint-1`             | Sprint 1 integration branch              | Sprint lead  |
| `m1/v0.1/feat/frontend-app-shell`  | Frontend shell and integration readiness | m1 - Abarado |
| `m2/v0.1/feat/backend-core`        | Backend core infrastructure              | m2 - Ramos   |
| `m3/v0.1/feat/database-foundation` | Database foundation implementation start | m3 - Vito    |

## Governance Rules

| Rule               | Requirement                                     |
| ------------------ | ----------------------------------------------- |
| Main protection    | Never commit directly to `main`                 |
| Staging protection | Never commit directly to `staging`              |
| Feature isolation  | Never merge feature branches directly to `main` |
| Pull requests      | Every merge requires a pull request             |
| CI                 | All checks must pass before merge               |
| Integration        | Sprint branch is the integration branch         |
| Pre-release        | Staging is the pre-release branch               |
| Stability          | Main is always stable                           |

## Allowed Branch Formats

| Branch Type    | Format                          | Example                           |
| -------------- | ------------------------------- | --------------------------------- |
| Sprint branch  | `sprint/version/sprint-number`  | `sprint/v0.1/sprint-1`            |
| Member branch  | `member/version/type/task-name` | `m1/v0.1/feat/frontend-app-shell` |
| Staging branch | `staging`                       | `staging`                         |

## Allowed Member Branch Types

| Type       | Purpose                                |
| ---------- | -------------------------------------- |
| `feat`     | Feature or infrastructure feature work |
| `fix`      | Bug fix                                |
| `docs`     | Documentation                          |
| `chore`    | Maintenance                            |
| `refactor` | Internal structure improvement         |
| `test`     | Test work                              |
