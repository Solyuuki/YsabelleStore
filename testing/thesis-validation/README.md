# Thesis Validation Workspace

This folder contains the thesis-specific validation plan for the YsabelleStore system.

## Purpose

The goal is to produce reproducible evidence for Chapter 3 without changing the production behavior of the system.

The validation basis is:

1. the YsabelleStore Statement of the Problem;
2. the implemented system behavior on the latest `main` baseline;
3. the testing and forecasting procedures already documented in the thesis methodology.

This workspace is intentionally separate from the repository's ordinary regression suites.

## Core Rule

A test result must not be marked `PASS` before execution.

For each test, record:

- Test ID
- SOP / requirement area
- precondition
- exact procedure
- expected result
- actual result
- evidence path
- status: PASS / FAIL / BLOCKED / NOT TESTED
- exact commit SHA used for execution

## Validation Layers

| Layer | Purpose | Evidence |
| --- | --- | --- |
| Existing automated tests | Re-run implemented regression and contract checks | terminal / CI output |
| Controlled UI validation | Demonstrate actual user workflows and state changes | before/action/after screenshots |
| Integration validation | Prove connected modules produce consistent data | screenshots + IDs + numeric state changes |
| Hardware-software validation | Validate barcode/print software pathways where physical hardware is unavailable | terminal/UI output; physical device claim excluded |
| SARIMA validation | Quantitatively validate forecast performance | MAE, MAPE, RMSE, residuals, CSV, plots |

## Hardware Limitation Rule

When the physical barcode scanner or thermal receipt printer is unavailable:

- software-side barcode input compatibility may be tested using keyboard-equivalent input;
- receipt generation and print-dispatch logic may be tested;
- physical scanner compatibility must remain `NOT TESTED`;
- physical thermal-printer output must remain `NOT TESTED`.

Do not convert a software-only result into a physical-device PASS.

## MPOS

Mobile POS is outside the current thesis validation cycle until its implementation status is finalized. It must not be reported as Passed without executable evidence.

## Evidence Folders

- `evidence/manual/` — controlled UI screenshots and notes
- `evidence/automated/` — terminal or CI outputs
- `evidence/sarima/` — forecast validation outputs
- `results/` — consolidated test-result tables for Chapter 3

See `TEST-MATRIX.md` and `EVIDENCE-STANDARD.md` before executing tests.

## Implemented Commands

Install thesis-only Python validation dependencies:

```bash
npm run thesis:sarima:install
```

Export the same canonical completed monthly sales used by the forecasting pipeline:

```bash
npm run thesis:sarima:export
```

Run chronological SARIMA hold-out validation with visual evidence:

```bash
npm run thesis:sarima:validate
```

Run export and validation together:

```bash
npm run thesis:sarima:run
```

Run thesis validator unit tests:

```bash
npm run thesis:sarima:test
```

Run the existing npm/backend/frontend/forecast regression suites and preserve terminal evidence:

```bash
npm run thesis:qa:run
```

## SARIMA Visual Evidence

The Python validator produces:

- `summary_metrics.csv`
- `product_metrics.csv`
- `detailed_calculations.csv`
- `excluded_products.csv`
- `validation_metadata.json`
- `validation_report.txt`
- `validation_report.html`
- `mae_rmse_units.png`
- `mape_percentage.png`
- `actual_vs_forecast_overall.png`
- `actual_vs_forecast_representative.png`
- `residual_plot_representative.png`
- `residual_distribution.png`

MAE, MAPE, and RMSE are computed with scikit-learn and independently cross-checked with NumPy formulas. MAPE excludes only zero-actual observations; those observations remain included in MAE and RMSE.

For the currently available verified 24-month workbook history, the thesis retrospective protocol is frozen at 19 training months and 5 held-out testing months. The deployed forecasting service is unchanged and still requires 24 completed monthly observations before standard SARIMA execution. Products that fail the thesis backtest are not silently dropped: they are written to `excluded_products.csv` with a reason.
