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
| SARIMA validation | Quantitatively validate forecast performance | MAE, MAPE, RMSE, residuals, CSV, plots |\n| System evaluation | Compute criterion-level and overall evaluator results from the approved instrument | response CSV, criterion results, overall result, report, Figure 16 |

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

Run chronological SARIMA hold-out validation and automatically open the Python desktop dashboard:

```bash
npm run thesis:sarima:validate
```

Run the computation without opening the desktop window:

```bash
npm run thesis:sarima:validate:headless
```

Re-open the latest Python dashboard without recomputing the metrics:

```bash
npm run thesis:sarima:gui
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

The primary visual presentation is a **Tkinter desktop GUI with embedded Matplotlib charts**. The browser HTML report has been removed. The GUI contains Summary, Actual vs Forecast, Residual Analysis, Product Results, and Validation Info tabs.

The Python validator produces:

- `summary_metrics.csv`
- `product_metrics.csv`
- `detailed_calculations.csv`
- `excluded_products.csv`
- `validation_metadata.json`
- `validation_report.txt`
- `mae_rmse_units.png`
- `mape_percentage.png`
- `actual_vs_forecast_overall.png`
- `actual_vs_forecast_representative.png`
- `residual_plot_representative.png`
- `residual_distribution.png`

MAE, MAPE, and RMSE are computed with scikit-learn and independently cross-checked with NumPy formulas. MAPE excludes only zero-actual observations; those observations remain included in MAE and RMSE.

For the currently available verified 24-month workbook history, the thesis retrospective protocol is frozen at 19 training months and 5 held-out testing months. The deployed forecasting service is unchanged and still requires 24 completed monthly observations before standard SARIMA execution. Products that fail the thesis backtest are not silently dropped: they are written to `excluded_products.csv` with a reason.


## System Evaluation Commands

Validate the System Evaluation calculator itself:

```bash
npm run thesis:evaluation:test
```

After copying the exact approved rating scale and interpretation rules into
`data/system_evaluation_config.json`, and placing the actual evaluator responses in
`data/system_evaluation_responses.csv`, run:

```bash
npm run thesis:evaluation:run
```

The calculator produces criterion-level means, the overall mean, verbal interpretations,
optional PASS/FAIL only when an approved acceptance threshold is configured, a text report,
metadata, and `figure16_system_evaluation.png`. A real failing score is preserved and
returns a non-zero process status; the validation workflow does not alter data to force a pass.

If the local configuration or response file is still incomplete, `thesis:evaluation:run` now reports `Status: BLOCKED` with the missing setup requirements instead of printing a Python traceback. The command still returns non-zero so an incomplete evaluation cannot be mistaken for a successful result.


## AI-Assisted Evidence Review

A separate evidence-based pre-evaluation is available for cases where the project team wants an immediate structured review based on the screenshots and reproducible test evidence already collected:

```bash
npm run thesis:evaluation:evidence
```

This command uses the committed files in `testing/thesis-validation/proposed/` and writes results to `evidence/system-evaluation-evidence-review/`.

The reviewer is explicitly labeled `AI_EVIDENCE_REVIEW_001`. This is **not an independent human evaluator** and must not be reported as external respondent data. It is intended as a researcher/AI-assisted evidence review or readiness assessment. If the adviser/school requires human evaluators, those responses still need to be collected separately with `thesis:evaluation:run`.
