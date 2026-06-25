# Naming Rules

Naming consistency is mandatory. Improper branch names, unclear file names, and inconsistent code names must be corrected before merge.

## Branch Naming Standard

Required member branch format:

```text
member/version/type/task-name
```

| Segment     | Rule                                 | Example              |
| ----------- | ------------------------------------ | -------------------- |
| `member`    | Must be `m1`, `m2`, or `m3`          | `m1`                 |
| `version`   | Must use `v` plus major/minor number | `v0.2`               |
| `type`      | Must be an allowed type              | `feat`               |
| `task-name` | Must be lowercase kebab-case         | `product-management` |

Required sprint branch format:

```text
sprint/version/sprint-number
```

| Segment         | Rule                                 | Example    |
| --------------- | ------------------------------------ | ---------- |
| `sprint`        | Literal branch prefix                | `sprint`   |
| `version`       | Must use `v` plus major/minor number | `v0.1`     |
| `sprint-number` | Must use `sprint-` plus a number     | `sprint-1` |

The `staging` branch is allowed only as the pre-release validation branch.

The `main` branch is the stable, protected, always deployable branch and is not used for direct feature work.

## Allowed Branch Types

| Type       | Purpose       |
| ---------- | ------------- |
| `feat`     | New feature   |
| `fix`      | Bug fix       |
| `docs`     | Documentation |
| `refactor` | Refactoring   |
| `test`     | Testing       |
| `chore`    | Maintenance   |

## Valid Branch Examples

| Valid Branch                       | Reason                                    |
| ---------------------------------- | ----------------------------------------- |
| `sprint/v0.1/sprint-1`             | Sprint integration branch is clear        |
| `staging`                          | Pre-release validation branch             |
| `m1/v0.1/feat/frontend-app-shell`  | Sprint 1 frontend assignment is clear     |
| `m2/v0.1/feat/backend-core`        | Sprint 1 backend assignment is clear      |
| `m3/v0.1/feat/database-foundation` | Sprint 1 database assignment is clear     |
| `m1/v0.1/docs/project-foundation`  | Member, version, type, and task are clear |
| `m1/v0.2/feat/product-management`  | UI feature assigned to m1                 |
| `m2/v0.3/feat/inventory-api`       | Backend feature assigned to m2            |
| `m3/v0.4/feat/sarima-engine`       | Forecasting feature assigned to m3        |
| `m1/v0.5/fix/login-validation`     | Focused bug fix                           |

## Invalid Branch Examples

| Invalid Branch      | Problem                                  |
| ------------------- | ---------------------------------------- |
| `update`            | No member, version, type, or task        |
| `final`             | Not descriptive and not traceable        |
| `test123`           | No approved format                       |
| `structure.2414122` | Uses invalid separators and unclear task |
| `random`            | No ownership or scope                    |
| `newbranch`         | Generic and unreviewable                 |

## Branch Validation Rule

| Rule                                                   | Enforcement                                       |
| ------------------------------------------------------ | ------------------------------------------------- |
| `main` is allowed only as the stable branch            | Direct feature work must not target `main`        |
| `staging` is allowed only as the pre-release branch    | GitHub Actions allows staging-to-main PRs         |
| Member branch names must match the member branch regex | GitHub Actions blocks invalid PR branches         |
| Sprint branch names must match the sprint branch regex | GitHub Actions allows sprint integration branches |
| Improper branch names must not be merged               | Reviewer must reject PR                           |
| Branch name must match task ownership                  | Owner approval required for cross-member files    |

Main branch regex:

```text
^main$
```

Staging branch regex:

```text
^staging$
```

Member branch regex:

```text
^(m1|m2|m3)/v[0-9]+\.[0-9]+/(feat|fix|docs|refactor|test|chore)/[a-z0-9]+(-[a-z0-9]+)*$
```

Sprint branch regex:

```text
^sprint/v[0-9]+\.[0-9]+/sprint-[0-9]+$
```

## Official Branch Governance Allowlist

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

## Pull Request Naming

| Standard                         | Example                                            |
| -------------------------------- | -------------------------------------------------- |
| `type(scope): short description` | `feat(inventory): add batch stock endpoint`        |
| Use lowercase type               | `docs(workflow): document merge checklist`         |
| Scope should identify module     | `fix(forecast): handle insufficient sales history` |

## Commit Message Naming

| Good Example                                | Bad Example           |
| ------------------------------------------- | --------------------- |
| `feat(products): add product status filter` | `added stuff`         |
| `fix(import): validate negative quantities` | `fix bug`             |
| `docs(standards): clarify branch naming`    | `documentation final` |
| `test(api): cover inventory threshold rule` | `tests`               |

## Code Naming Standards

| Item                  | Standard                                             | Good Example             | Bad Example                   |
| --------------------- | ---------------------------------------------------- | ------------------------ | ----------------------------- |
| React Components      | PascalCase                                           | `ProductInventoryTable`  | `producttable`                |
| Pages                 | PascalCase with `Page` suffix                        | `InventoryDashboardPage` | `inventory`                   |
| Hooks                 | camelCase with `use` prefix                          | `useInventoryFilters`    | `inventoryHook`               |
| Services              | camelCase file, clear domain                         | `inventoryService.ts`    | `helper.ts`                   |
| Utilities             | camelCase and purpose-based                          | `formatCurrency.ts`      | `utils2.ts`                   |
| Interfaces            | PascalCase with descriptive noun                     | `InventoryBatchInput`    | `IData`                       |
| Types                 | PascalCase                                           | `ForecastStatus`         | `status_type`                 |
| Constants             | UPPER_SNAKE_CASE                                     | `LOW_STOCK_THRESHOLD`    | `lowStock`                    |
| API Routes            | kebab-case URL path                                  | `/api/inventory-batches` | `/api/getInventoryBatchesNow` |
| Prisma Models         | PascalCase singular                                  | `InventoryBatch`         | `inventory_batches`           |
| Database Tables       | snake_case plural through Prisma mapping when needed | `inventory_batches`      | `InventoryBatchTable`         |
| Database Columns      | snake_case                                           | `expiration_date`        | `expirationDateColumn`        |
| Environment Variables | UPPER_SNAKE_CASE                                     | `DATABASE_URL`           | `databaseUrl`                 |

## File Naming Decision Table

| File Type            | Naming Rule                   |
| -------------------- | ----------------------------- |
| React component file | `PascalCase.tsx`              |
| Hook file            | `useFeatureName.ts`           |
| Service file         | `featureService.ts`           |
| Route file           | `feature.routes.ts`           |
| Controller file      | `feature.controller.ts`       |
| Validator file       | `feature.validator.ts`        |
| Python module        | `snake_case.py`               |
| Markdown standard    | Numbered lowercase kebab-case |

## Naming Checklist

- [ ] Branch follows the mandatory member, sprint, or staging format
- [ ] PR title follows Conventional Commit style
- [ ] Files use the correct case for their layer
- [ ] API paths are stable and kebab-case
- [ ] Database names are readable and consistent
- [ ] Environment variables are uppercase snake case
