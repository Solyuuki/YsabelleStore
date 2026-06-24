# GitHub Workflow

This guide defines the required GitHub process for YsabelleStore. Every contribution must follow this workflow before it can be merged into `main`.

## Branch Creation

| Step              | Command                                           | Standard                               |
| ----------------- | ------------------------------------------------- | -------------------------------------- |
| Update local main | `git checkout main` then `git pull origin main`   | Start from the latest approved version |
| Create branch     | `git checkout -b m1/v0.1/docs/project-foundation` | Use the required branch format         |
| Confirm branch    | `git branch --show-current`                       | Verify name before coding              |

## Branch Naming

| Field     | Example              | Rule                              |
| --------- | -------------------- | --------------------------------- |
| Member    | `m1`                 | Must be `m1`, `m2`, or `m3`       |
| Version   | `v0.2`               | Must match sprint/project version |
| Type      | `feat`               | Must be an allowed work type      |
| Task name | `product-management` | Lowercase kebab-case              |

Required format:

```text
member/version/type/task-name
```

Valid examples:

| Branch                            | Use                        |
| --------------------------------- | -------------------------- |
| `m1/v0.1/docs/project-foundation` | Documentation foundation   |
| `m2/v0.3/feat/inventory-api`      | Inventory API feature      |
| `m3/v0.4/feat/sarima-engine`      | Forecasting engine feature |

## Commit Rules

| Commit Type | Purpose                | Example                                      |
| ----------- | ---------------------- | -------------------------------------------- |
| `feat`      | New feature            | `feat(inventory): add batch stock endpoint`  |
| `fix`       | Bug fix                | `fix(import): reject invalid csv quantities` |
| `docs`      | Documentation          | `docs(workflow): add merge checklist`        |
| `refactor`  | Internal restructuring | `refactor(api): isolate inventory service`   |
| `test`      | Test coverage          | `test(forecast): cover sarima validation`    |
| `chore`     | Maintenance            | `chore(repo): configure prettier`            |

## Push Rules

| Rule               | Requirement                                           |
| ------------------ | ----------------------------------------------------- |
| Pull first         | Run `git pull origin main` before creating a branch   |
| Push branch only   | Never push direct commits to `main`                   |
| Keep scope focused | One branch equals one task or one tightly related fix |
| Verify locally     | Run available checks before pushing                   |

## Pull Request Creation

| PR Field       | Requirement                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| Title          | Use Conventional Commit style, such as `feat(inventory): add product stock table` |
| Summary        | Explain what changed in 2-5 bullets                                               |
| Affected Files | List folders or files touched                                                     |
| Tests          | Record commands and results                                                       |
| Ownership      | Identify member ownership and reviewer                                            |

## Review Process

| Stage           | Reviewer Action                                                   |
| --------------- | ----------------------------------------------------------------- |
| Scope check     | Confirm PR matches the branch task                                |
| Ownership check | Confirm affected files are owned by assignee or approved by owner |
| Quality check   | Check naming, modularity, validation, and error handling          |
| Test check      | Confirm evidence is provided                                      |
| Merge approval  | Approve only after all required checks pass                       |

## Merge Process

| Step                | Requirement                                                           |
| ------------------- | --------------------------------------------------------------------- |
| Resolve comments    | All requested changes must be addressed                               |
| Pass checks         | GitHub Actions must be green                                          |
| Confirm branch name | Branch validation must pass                                           |
| Confirm no conflict | PR must be mergeable                                                  |
| Merge               | Use squash merge for a clean history unless the team agrees otherwise |

## Conflict Handling

| Situation                         | Action                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| Conflict in owned file            | Assigned member resolves and documents the decision               |
| Conflict in another member's file | Ask owner before editing                                          |
| Migration conflict                | Coordinate with m2 before changing Prisma migrations              |
| Forecasting conflict              | Coordinate with m3 before changing Python model logic             |
| UI shell conflict                 | Coordinate with m1 before changing layout or Electron entry files |

## Release Workflow

| Stage               | Action                                                       |
| ------------------- | ------------------------------------------------------------ |
| Version planning    | Agree version label, such as `v0.5`                          |
| Freeze scope        | Merge only approved release tasks                            |
| Validate build      | Run lint, tests, database validation, and packaging checks   |
| Package desktop app | Use `electron-builder` when application code is ready        |
| Tag release         | Create a GitHub release tag after evaluator-ready validation |

## PR Checklist

- [ ] Branch name follows `member/version/type/task-name`
- [ ] PR title follows Conventional Commit style
- [ ] Affected files are listed
- [ ] Ownership has been checked
- [ ] Build, lint, and tests were run when available
- [ ] No unrelated changes are included
- [ ] Reviewer approval is complete
