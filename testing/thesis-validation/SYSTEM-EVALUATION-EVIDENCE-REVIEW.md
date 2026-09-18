# YsabelleStore AI-Assisted Evidence Review

## Status

This file records an **AI-assisted evidence-based pre-evaluation** using the proposed System Evaluation Questionnaire.

It is **not an independent human evaluator response**. It must not be described in the thesis as external evaluator data unless the adviser/school explicitly allows this evaluation source.

## Evidence used

The ratings below were based on the supplied screenshots and reproducible validation outputs, including:

- SARIMA validation: 472 products, 2,360 held-out observations, MAE 2.1544, MAPE 15.2828%, RMSE 3.3660, with all three metric cross-checks passing;
- automated thesis QA: 5/5 suites passed and 0 failed;
- POS, Sales, Inventory, Stock Activity, Receiving, Restock, Supplier Return, Forecast, Reports, Product Management, Expiration, User Management, and E-commerce screenshots;
- demonstrated partial-receiving rule: 8 expected, 5 accepted, 3 remaining, with only accepted physical units added;
- demonstrated restock-to-receiving workflow and the rule that approval itself does not represent physical stock receipt.

## Rating method

The 1–5 ratings were assigned item-by-item from the available evidence.

A rating of **5** was used only where the supplied evidence directly and repeatedly supported the statement.  
A rating of **4** was used where the evidence supported the statement but did not include exhaustive performance, fault-injection, hardware, or long-term operational testing.  
A rating of **3** was used for IC2 because actual human learnability/usability observation was not available.

The ratings were not changed to force a passing result.

| Item | Rating | Evidence-based rationale |
| --- | ---: | --- |
| FS1 | 5 | Implemented modules and screenshots cover the intended inventory, sales, forecast, replenishment, receiving, reporting, e-commerce, and user-management scope. |
| FS2 | 5 | Numeric workflow evidence and automated tests support correct quantities/statuses; SARIMA metrics are independently cross-checked. |
| FS3 | 5 | Demonstrated workflows align with the store's operational tasks and SOP areas. |
| PE1 | 4 | Common UI actions were demonstrated without abnormal delays, but no formal response-time benchmark was run. |
| PE2 | 4 | Core operations completed successfully in demonstrations/tests; no dedicated latency benchmark was recorded. |
| PE3 | 4 | Forecast validation processed 472 products and 2,360 holdout observations, but no formal load/stress test was recorded. |
| C1 | 5 | POS, Sales, Inventory, Receiving, Restock, Forecast and Reports are shown exchanging consistent state. |
| C2 | 5 | Administrative/customer-facing workflows use shared catalog/inventory/order state with controlled stock-deduction rules. |
| C3 | 4 | Import/export/barcode software pathways are covered; physical peripherals remain outside the evidence. |
| IC1 | 4 | Screenshots show organized navigation, tables, forms and labels. |
| IC2 | 3 | Learnability was not measured with independent human usability participants. |
| IC3 | 5 | Confirmation, validation, status, and blocked-state messages are visibly used across workflows. |
| R1 | 5 | Automated regression suites and repeated workflow checks passed. |
| R2 | 5 | Sales, receipt, ledger and receiving records are persisted and reopened in the demonstrated workflows. |
| R3 | 4 | Guardrails and validation are present; exhaustive fault-injection testing was not performed. |
| SEC1 | 4 | Owner/Staff restrictions exist in the implemented access model; the manual Staff-denial proof remains less complete than other areas. |
| SEC2 | 4 | Authentication/protected access behavior is implemented and covered by system guardrails, but no penetration test was claimed. |
| SEC3 | 5 | Receipt references, histories, receiving references and stock activity provide traceability. |
| M1 | 5 | Repository structure is modular across frontend, backend, forecasting service, scripts and tests. |
| M2 | 5 | Automated regression, forecast, barcode and thesis-specific validation suites are implemented and reproducible. |
| M3 | 5 | Test plans, evidence standards, metadata, logs, reports and validation outputs support traceability. |
| FL1 | 5 | Product, supplier, inventory and operational data are managed through system interfaces/imports rather than routine source edits. |
| FL2 | 4 | Configurable workflows and data support changes, though not every future operational variation was tested. |
| FL3 | 4 | Modular architecture supports extension, but future extension capability was not independently measured. |
| SA1 | 4 | Confirmation/validation/access controls reduce accidental changes; no formal human-error study was performed. |
| SA2 | 5 | Restock approval, receiving, adjustment and sale rules explicitly prevent silent stock changes and only physical receipt changes stock. |
| SA3 | 4 | Important validation/errors are surfaced, but exhaustive exceptional-condition testing was not performed. |

## Limitation

Use this output as a **researcher/AI-assisted evidence review** or readiness assessment. If the thesis methodology requires independent evaluators or a minimum number of respondents, actual human responses are still required.
