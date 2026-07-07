# M2 - Ramos

## Role

SARIMA / Forecasting / Reports Lead

## Sprint 3 Focus

Build the forecasting foundation, define the SARIMA service structure, establish the forecast data contract, and set up
the reports foundation that can consume sales and forecast summaries.

## Assigned Modules

| Module              | Responsibility                                                 |
| ------------------- | -------------------------------------------------------------- |
| Forecasting service | SARIMA service skeleton and processing foundation              |
| Forecast API        | Forecast input and output contract                             |
| Forecast page       | Display forecast results in a structured way                   |
| Reports page        | Display sales and forecast summaries                           |
| Documentation       | Capture SARIMA parameters, preprocessing, and evaluation notes |

## Task Table

| Task ID   | Task                                                           | Type             | Priority | Dependencies                               | Status  |
| --------- | -------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------ | ------- |
| S3-M2-001 | Design SARIMA service structure                                | Architecture     | P0       | Clean sales/product data contract          | Planned |
| S3-M2-002 | Define historical sales input format for SARIMA                | Data contract    | P0       | M1 sales shape, M3 product/inventory shape | Planned |
| S3-M2-003 | Implement forecasting service foundation                       | Feature          | P0       | S3-M2-001, S3-M2-002                       | Planned |
| S3-M2-004 | Add forecast API and data contract                             | Integration      | P0       | S3-M2-003                                  | Planned |
| S3-M2-005 | Add sample forecast output for supported products              | Feature / QA     | P1       | Forecast contract                          | Planned |
| S3-M2-006 | Prepare Forecast page for forecast results                     | UI / Integration | P1       | S3-M2-004, S3-M2-005                       | Planned |
| S3-M2-007 | Prepare Reports page for sales and forecast summaries          | UI / Integration | P1       | Sales data, forecast contract              | Planned |
| S3-M2-008 | Document SARIMA parameters, preprocessing, and evaluation plan | Documentation    | P1       | S3-M2-001, S3-M2-002                       | Planned |

## Dependencies

| Dependency                    | Why It Matters                                                 |
| ----------------------------- | -------------------------------------------------------------- |
| M3 product and inventory data | SARIMA needs clean product-level context and historical inputs |
| M1 sales transaction shape    | Forecasting and reports need a consistent sales history source |
| Shared output contract        | Forecast page and reports must consume the same forecast shape |

## Deliverables

| Deliverable           | Expected Shape                                                |
| --------------------- | ------------------------------------------------------------- |
| SARIMA foundation     | Service skeleton and processing path exist                    |
| Forecast contract     | Input and output data shapes are documented                   |
| Forecast UI readiness | Forecast page can display structured output                   |
| Reports foundation    | Reports page has a sales/forecast summary starting point      |
| Technical notes       | Parameters, preprocessing, and evaluation plan are documented |

## Validation Checklist

| Check                | Expected Result                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Contract review      | Forecast input/output shape is explicit and reviewable                                          |
| Service review       | Forecasting service structure exists and is understandable                                      |
| UI readiness review  | Forecast and Reports pages can consume structured data                                          |
| Documentation review | SARIMA notes explain assumptions and evaluation direction                                       |
| Repo validation      | `npm run format`, `npm run lint`, and `npm run prepush:local` pass when sprint work is complete |

## Risks / Blockers

| Risk                                      | Impact                                     | Mitigation                                                     |
| ----------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Historical sales data is not clean enough | Forecast foundation may be blocked         | Coordinate early with M1 and M3 on data shapes                 |
| Forecast contract changes late            | Reports and UI work may churn              | Finalize the output contract before expanding the UI           |
| SARIMA scope grows too quickly            | Sprint may drift away from foundation work | Limit Sprint 3 to structure, data contract, and starter output |
| Reports overreach before data is stable   | Unreliable output may be shown             | Keep reports to summaries backed by known inputs               |

## Notes for PR

| Note                  | Guidance                                                                   |
| --------------------- | -------------------------------------------------------------------------- |
| Scope honesty         | Describe the work as a foundation unless the data path is genuinely usable |
| Data contract clarity | Mention any sales-history or forecast-output assumptions explicitly        |
| Integration points    | Call out what M1 and M3 must support for the next merge                    |
| Documentation         | Keep SARIMA notes precise so Sprint 4 can build on them                    |
