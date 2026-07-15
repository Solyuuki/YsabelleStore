# Sprint 3 Definition of Done

Sprint 3 is done only if:

## General

| Criteria                                             | Evidence                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run prepush:local` passes                       | Local validation workflow completed successfully                         |
| All changed files are documented in member artifacts | M1, M2, and M3 task/progress docs updated                                |
| Sprint 3 docs are updated                            | Sprint 3 planning files exist and are internally consistent              |
| No Sprint 2 auth behavior is broken                  | Trusted-device, logout, session restore, and role handling remain intact |
| No known merge conflict remains                      | Final merged branch is clean                                             |
| PR title and branch naming follow standards          | Branch and PR validation rules are satisfied                             |

## M1

| Criteria                                          | Evidence                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| UI cleanup is applied across visible module pages | Dashboard and shell pages are no longer cramped or visually broken |
| POS flow can search/select products               | Product lookup or scan placeholder-to-real path exists             |
| Sales flow records or displays sale transactions  | Checkout foundation is wired into the page or API layer            |
| Integration issues are resolved                   | M1, M2, and M3 work together without blockers                      |
| Final merged Sprint 3 branch passes validation    | Build, format, lint, and local prepush succeed                     |

## M2

| Criteria                                                 | Evidence                                        |
| -------------------------------------------------------- | ----------------------------------------------- |
| SARIMA service foundation exists                         | Forecasting service structure is present        |
| Forecast data contract is documented                     | Input/output shape is written down and usable   |
| Forecast page uses structured forecast data              | Forecast results can be consumed by UI or API   |
| Reports page has a sales/forecast foundation             | Summary views have a real data shape to consume |
| SARIMA preprocessing and evaluation notes are documented | Parameters and methodology are captured         |

## M3

| Criteria                                                    | Evidence                                       |
| ----------------------------------------------------------- | ---------------------------------------------- |
| Products module has a functional data foundation            | Product API/model exists                       |
| Inventory module has a functional data foundation           | Inventory API/model exists                     |
| Stock movement logic exists                                 | Stock changes can be recorded or represented   |
| Seed/sample product and inventory data exists               | Clean support data is available for the sprint |
| Data is clean enough for POS, Sales, and SARIMA integration | Shared data contracts are usable by M1 and M2  |

## Validation Status

| Date       | Member     | Validation Checklist       | Status | Notes                      |
| ---------- | ---------- | -------------------------- | ------ | -------------------------- |
| 2026-07-10 | M1 Abarado | prepush:local / push-ready | Passed | Validation passed locally. |
| 2026-07-10 | M3 Vito    | prepush:local / push-ready | Passed | Validation passed locally. |
| 2026-07-11 | M1 Abarado | prepush:local / push-ready | Passed | Validation passed locally. |
| 2026-07-12 | M1 Abarado | prepush:local / push-ready | Passed | Validation passed locally. |
| 2026-07-15 | M1 Abarado | prepush:local / push-ready | Passed | Validation passed locally. |
