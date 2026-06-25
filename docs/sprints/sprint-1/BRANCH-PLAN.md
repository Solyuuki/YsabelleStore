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

| Branch                             | Purpose                                                                 | Owner        |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------ |
| `main`                             | Stable, always deployable, protected branch with no direct feature work | Sprint lead  |
| `staging`                          | Protected pre-release integration branch for completed sprint branches  | Sprint lead  |
| `sprint/v0.1/sprint-1`             | Sprint 1 integration branch for member feature branches only            | Sprint lead  |
| `m1/v0.1/feat/frontend-app-shell`  | Frontend shell and integration readiness                                | m1 - Abarado |
| `m2/v0.1/feat/backend-core`        | Backend core infrastructure                                             | m2 - Ramos   |
| `m3/v0.1/feat/database-foundation` | Database foundation implementation start                                | m3 - Vito    |

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

## Branch Creation Command Guide

Create `staging` from `main`:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Create Sprint 1 branch from `staging`:

```bash
git checkout staging
git pull origin staging
git checkout -b sprint/v0.1/sprint-1
git push -u origin sprint/v0.1/sprint-1
```

Create m1 Sprint 1 member branch:

```bash
git checkout sprint/v0.1/sprint-1
git pull origin sprint/v0.1/sprint-1
git checkout -b m1/v0.1/feat/frontend-app-shell
git push -u origin m1/v0.1/feat/frontend-app-shell
```

Create m2 Sprint 1 member branch:

```bash
git checkout sprint/v0.1/sprint-1
git pull origin sprint/v0.1/sprint-1
git checkout -b m2/v0.1/feat/backend-core
git push -u origin m2/v0.1/feat/backend-core
```

Create m3 Sprint 1 member branch:

```bash
git checkout sprint/v0.1/sprint-1
git pull origin sprint/v0.1/sprint-1
git checkout -b m3/v0.1/feat/database-foundation
git push -u origin m3/v0.1/feat/database-foundation
```

## GitHub Governance Allowlist

| Allowed Branch Name  | Purpose                       |
| -------------------- | ----------------------------- |
| `main`               | Stable deployable branch      |
| `staging`            | Pre-release validation branch |
| `sprint/v*/sprint-*` | Sprint integration branch     |
| `m1/v*/feat/*`       | m1 assigned feature work      |
| `m2/v*/feat/*`       | m2 assigned feature work      |
| `m3/v*/feat/*`       | m3 assigned feature work      |
| `m*/v*/fix/*`        | Member bug fix work           |
| `m*/v*/docs/*`       | Member documentation work     |
| `m*/v*/refactor/*`   | Member refactor work          |
| `m*/v*/test/*`       | Member test work              |
| `m*/v*/chore/*`      | Member maintenance work       |

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
