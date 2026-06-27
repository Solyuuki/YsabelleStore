# GitHub Workflow

This guide defines the required GitHub process for YsabelleStore. Every contribution must follow this workflow before it can be merged into `main`, `staging`, or an active sprint branch.

## CI Overview

| Workflow                    | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `repository-governance.yml` | Enforces branch naming and repository documentation hygiene      |
| `ci.yml`                    | Runs the main quality gates for push and pull request validation |
| `pull-request-checks.yml`   | Verifies PR title and required PR body sections                  |

## Local Validation Commands

Run these before opening a pull request:

```bash
npm run format
npm run format:check
npm run lint
npm run build
npm audit --audit-level=high
npx prisma validate --schema=database/prisma/schema.prisma
```

## Local Git Hooks

Husky protects the repository before commit and before push:

| Hook         | Local Commands                                                                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | `npm run lint`, then `npm run format:check`                                                                                                                                                                                                                                           |
| `pre-push`   | `npm run typecheck` or the repository equivalent, `npm run build` with the temporary validation `DATABASE_URL`, `npx prisma validate --schema=database/prisma/schema.prisma` with the same temporary `DATABASE_URL`, `npm audit --audit-level=high`, and optional tests if they exist |

The `pre-push` hook uses the same temporary validation database URL already used by repository validation:

```text
mysql://root:password@localhost:3306/ysabellestore_validation
```

If repository policy allows an intentional bypass, developers can skip Husky hooks with:

```bash
git commit --no-verify
git push --no-verify
```

Use `--no-verify` only when the bypass is explicitly allowed.

## GitHub Validation Commands

GitHub Actions runs the same quality gates with a clean install:

```bash
npm ci
npm run format:check
npm run lint
npm run build
npm audit --audit-level=high
npx prisma validate --schema=database/prisma/schema.prisma
```

The CI workflow also validates the `frontend`, `backend`, and `electron` workspaces individually.

## Branch Creation

| Step              | Command                                           | Standard                               |
| ----------------- | ------------------------------------------------- | -------------------------------------- |
| Update local main | `git checkout main` then `git pull origin main`   | Start from the latest approved version |
| Create branch     | `git checkout -b m1/v0.1/docs/project-foundation` | Use the required branch format         |
| Confirm branch    | `git branch --show-current`                       | Verify name before coding              |

## Official Sprint 1 Branch Commands

Create `staging`:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

Create `sprint/v0.1/sprint-1`:

```bash
git checkout staging
git pull origin staging
git checkout -b sprint/v0.1/sprint-1
git push -u origin sprint/v0.1/sprint-1
```

Create member branches:

```bash
git checkout sprint/v0.1/sprint-1
git pull origin sprint/v0.1/sprint-1
git checkout -b m1/v0.1/feat/frontend-app-shell
git push -u origin m1/v0.1/feat/frontend-app-shell

git checkout sprint/v0.1/sprint-1
git pull origin sprint/v0.1/sprint-1
git checkout -b m2/v0.1/feat/backend-core
git push -u origin m2/v0.1/feat/backend-core

git checkout sprint/v0.1/sprint-1
git pull origin sprint/v0.1/sprint-1
git checkout -b m3/v0.1/feat/database-foundation
git push -u origin m3/v0.1/feat/database-foundation
```

## Sprint 1 Branch Flow

Sprint 1 uses `sprint/v0.1/sprint-1` as the integration branch and `staging` as the pre-release branch.

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

| Source Branch                      | Pull Request Target    | Purpose                                  |
| ---------------------------------- | ---------------------- | ---------------------------------------- |
| `m1/v0.1/feat/frontend-app-shell`  | `sprint/v0.1/sprint-1` | Frontend shell and integration readiness |
| `m2/v0.1/feat/backend-core`        | `sprint/v0.1/sprint-1` | Backend core infrastructure              |
| `m3/v0.1/feat/database-foundation` | `sprint/v0.1/sprint-1` | Database foundation implementation start |
| `sprint/v0.1/sprint-1`             | `staging`              | Sprint review integration                |
| `staging`                          | `main`                 | Release validation promotion             |

| Rule                 | Requirement                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| Main                 | Stable, always deployable, protected, and closed to direct feature work     |
| Staging              | Protected pre-release integration branch for final validation before `main` |
| Sprint branch        | Sprint 1 integration branch for member feature branches only                |
| Direct commits       | Do not commit directly to `main` or `staging`                               |
| Feature merge target | Feature branches must not merge directly to `main`                          |
| Pull requests        | Every branch promotion requires a PR                                        |

## Branch Naming

| Field     | Example              | Rule                                 |
| --------- | -------------------- | ------------------------------------ |
| Member    | `m1`                 | Must be `m1`, `m2`, or `m3`          |
| Version   | `v0.2`               | Must match sprint or project version |
| Type      | `feat`               | Must be an allowed work type         |
| Task name | `product-management` | Lowercase kebab-case                 |

Required format:

```text
member/version/type/task-name
```

Sprint branch format:

```text
sprint/version/sprint-number
```

Valid examples:

| Branch                             | Use                        |
| ---------------------------------- | -------------------------- |
| `sprint/v0.1/sprint-1`             | Sprint 1 integration       |
| `staging`                          | Pre-release validation     |
| `m1/v0.1/feat/frontend-app-shell`  | Sprint 1 frontend shell    |
| `m2/v0.1/feat/backend-core`        | Sprint 1 backend core      |
| `m3/v0.1/feat/database-foundation` | Sprint 1 database work     |
| `m1/v0.1/docs/project-foundation`  | Documentation foundation   |
| `m2/v0.3/feat/inventory-api`       | Inventory API feature      |
| `m3/v0.4/feat/sarima-engine`       | Forecasting engine feature |

GitHub governance accepts only:

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

## Commit Rules

| Commit Type | Purpose                | Example                                      |
| ----------- | ---------------------- | -------------------------------------------- |
| `feat`      | New feature            | `feat(inventory): add batch stock endpoint`  |
| `fix`       | Bug fix                | `fix(import): reject invalid csv quantities` |
| `docs`      | Documentation          | `docs(workflow): add merge checklist`        |
| `refactor`  | Internal restructuring | `refactor(api): isolate inventory service`   |
| `test`      | Test coverage          | `test(forecast): cover sarima validation`    |
| `chore`     | Maintenance            | `chore(repo): configure prettier`            |

## Pull Request Workflow

| Step             | Requirement                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| Open PR          | Use the repository PR template                                                 |
| Describe work    | Summarize the task, files changed, validation, risks, and owner or member code |
| Validate locally | Run the required quality commands before review                                |
| Review scope     | Keep one PR focused on one task or one tightly related fix                     |
| Merge            | Merge only after checks pass and reviewers approve                             |

## Pull Request Creation

| PR Field       | Requirement                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title          | Use Conventional Commit style or member-prefixed Conventional Commit style, such as `feat(inventory): add product stock table` or `m1/feat(inventory): add product stock table` |
| Summary        | Explain what changed in 2-5 bullets                                                                                                                                             |
| Affected Files | List folders or files touched                                                                                                                                                   |
| Validation     | Record commands and results                                                                                                                                                     |
| Ownership      | Identify member ownership and reviewer                                                                                                                                          |

### Valid PR Titles

- `feat: implement frontend shell`
- `m1/feat: implement frontend shell`
- `m2/fix(backend): resolve validation issue`
- `m3/docs(database): update schema notes`

### Invalid PR Titles

- `M1/v0.1/feat/frontend app shell`
- `m1/v0.1/feat/frontend-app-shell`
- `update`
- `random title`

## Review Process

| Stage           | Reviewer Action                                                   |
| --------------- | ----------------------------------------------------------------- |
| Scope check     | Confirm PR matches the branch task                                |
| Ownership check | Confirm affected files are owned by assignee or approved by owner |
| Quality check   | Check naming, modularity, validation, and error handling          |
| Test check      | Confirm evidence is provided                                      |
| Merge approval  | Approve only after all required checks pass                       |

## Merge Safety Rules

| Rule                | Requirement                                       |
| ------------------- | ------------------------------------------------- |
| Pass checks first   | GitHub Actions must be green                      |
| Confirm branch name | Branch validation must pass                       |
| Confirm no conflict | PR must be mergeable                              |
| Keep history clean  | Use squash merge unless the team agrees otherwise |
| Protect ownership   | Do not merge unapproved cross-owner edits         |

## Conflict Handling

| Situation                         | Action                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| Conflict in owned file            | Assigned member resolves and documents the decision               |
| Conflict in another member's file | Ask owner before editing                                          |
| Migration conflict                | Coordinate with m2 before changing Prisma migrations              |
| Forecasting conflict              | Coordinate with m3 before changing Python model logic             |
| UI shell conflict                 | Coordinate with m1 before changing layout or Electron entry files |

## Failed CI Troubleshooting

| Symptom               | First Check                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| Build fails           | Re-run `npm run build` locally and inspect the first failing package    |
| Lint fails            | Re-run `npm run lint` and review the reported file path                 |
| Format check fails    | Re-run `npm run format:check` and format the listed file                |
| Prisma validate fails | Verify `DATABASE_URL` is set for validation only                        |
| Audit fails           | Inspect the dependency report and update or replace vulnerable packages |

## Implementation Phase Branch Workflow

When feature work starts, use this sequence:

1. Pull the latest active sprint branch.
2. Create a branch that matches `member/version/type/task-name`.
3. Keep the branch focused on one task.
4. Run local validation before opening the PR.
5. Open a PR into the active sprint branch using the template.
6. Address CI failures before requesting merge.
7. Promote the sprint branch to `staging` only after sprint review.
8. Promote `staging` to `main` only after release validation.

## Release Workflow

| Stage               | Action                                                       |
| ------------------- | ------------------------------------------------------------ |
| Version planning    | Agree version label, such as `v0.5`                          |
| Freeze scope        | Merge only approved release tasks                            |
| Validate build      | Run lint, tests, database validation, and packaging checks   |
| Package desktop app | Use `electron-builder` when application code is ready        |
| Tag release         | Create a GitHub release tag after evaluator-ready validation |

## PR Checklist

- [ ] Branch name follows the approved member, sprint, or staging format
- [ ] PR title follows Conventional Commit style or member-prefixed Conventional Commit style
- [ ] Summary, files changed, validation, risks, and ownership are documented
- [ ] Affected files are listed
- [ ] Ownership has been checked
- [ ] Build, lint, and tests were run when available
- [ ] No unrelated changes are included
- [ ] Reviewer approval is complete
