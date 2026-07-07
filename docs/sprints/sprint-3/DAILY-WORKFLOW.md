# Sprint 3 Daily Workflow

## Working Rhythm

| Step | Action                                                       | Owner                   |
| ---- | ------------------------------------------------------------ | ----------------------- |
| 1    | Confirm the current branch, scope, and shared data contracts | All                     |
| 2    | Pull the latest merged changes before implementation starts  | All                     |
| 3    | Keep changes limited to the assigned module boundary         | M1, M2, M3              |
| 4    | Document any shared contract changes immediately             | Owner of the change     |
| 5    | Run the repo validation gates before review                  | Whoever finishes a task |
| 6    | Record evidence in the member artifact files                 | Each member             |

## Daily Focus Areas

| Member | Daily Focus                                                         | Validation Lens                                                               |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| M1     | UI cleanup, POS, Sales, integration review, merge conflict handling | Does the app still feel clean and usable?                                     |
| M2     | SARIMA foundation, forecast contract, reports data shape            | Can forecasting and reporting consume the same source of truth?               |
| M3     | Product data, inventory data, stock movement, seed data             | Are the product and inventory records reliable enough for downstream modules? |

## End-of-Day Checks

| Check                           | Expected Result                                                            |
| ------------------------------- | -------------------------------------------------------------------------- |
| Module scope stayed focused     | No random out-of-scope edits were introduced                               |
| Shared contracts are documented | Data shape changes were recorded in the appropriate doc                    |
| Validation was run              | Relevant format, lint, typecheck, build, or targeted checks were completed |
| Artifact notes were updated     | Member planning and progress files reflect the day’s work                  |
