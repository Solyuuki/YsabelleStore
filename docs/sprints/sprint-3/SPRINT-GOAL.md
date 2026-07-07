# Sprint 3 Goal

## Goal Statement

Build the first functional business workflow for YsabelleStore:
Products -> Inventory -> Sales/POS -> Forecasting/SARIMA -> Reports.

Sprint 3 should turn the current module shells into a practical foundation that can support clean data flow for
forecasting and later inventory recommendation work. This is still not the final thesis system, but it must be
functional enough to prove the core business pipeline.

## Sprint 3 Scope

| In Scope                                            | Out of Scope                                 |
| --------------------------------------------------- | -------------------------------------------- |
| Product data foundation                             | Final recommendation engine                  |
| Inventory data foundation                           | Fully trained SARIMA production pipeline     |
| Stock movement records                              | Release packaging and installer work         |
| POS product lookup and checkout foundation          | Auth/security redesign                       |
| Sales transaction recording foundation              | Large visual redesign outside layout cleanup |
| Forecast data contract and SARIMA service skeleton  | Fake completion of unfinished modules        |
| Reports foundation for sales and forecast summaries | Unrelated feature expansion                  |

## Expected Outcome

By the end of Sprint 3:

| Area        | Expected Outcome                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Products    | A usable product foundation exists for create/read/update workflows or an equivalent functional base |
| Inventory   | Inventory tracks stock and stock movement data in a structured way                                   |
| POS         | POS can search/select products and support the beginning of a sale flow                              |
| Sales       | Completed sale transactions can be recorded or displayed in a meaningful form                        |
| Forecasting | SARIMA has a documented service foundation and forecast data contract                                |
| Reports     | Reports can begin consuming structured sales and forecast data                                       |
| Integration | Module ownership boundaries are still clear and the sprint remains mergeable                         |

## Success Criteria

| Criterion                                              | Evidence                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Core modules are connected enough for demo development | Routes, services, or data contracts exist for product, inventory, sales, and forecast workflows |
| Forecasting has a real foundation                      | SARIMA structure, input format, and forecast output contract are documented                     |
| Reports have a starting contract                       | Sales and forecast summary shape is defined and can be consumed later                           |
| UI remains production-grade                            | Dashboard and shell pages are cleaned up without introducing random redesigns                   |
| Sprint 2 auth behavior remains stable                  | Trusted-device, logout, session restore, and role handling are preserved                        |

## Non-Goals

| Non-Goal                            | Reason                                                       |
| ----------------------------------- | ------------------------------------------------------------ |
| Full recommendation engine          | Requires stronger forecasting and inventory data first       |
| Perfect SARIMA tuning               | Foundation and data flow come before model optimization      |
| Complete enterprise reporting suite | Sprint 3 only starts the reporting layer                     |
| Broad visual redesign               | The sprint should focus on usable, clean, integrated modules |
