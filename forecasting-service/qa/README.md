# Recommender historical QA (isolated branch)

This is a **read-only**, rolling-origin accuracy diagnostic using the **2024 and 2025**
historical Excel workbooks. It does **not** connect to the operational MySQL database,
create orders, generate persisted forecast batches, or call restock automation.
Any generated report belongs in `forecasting-service/outputs/` (Git-ignored).

Run from repository root in **PowerShell**:

```powershell
python -m pytest forecasting-service/tests
npx tsx backend/src/scripts/qaRecommenderExportHistory.ts |
  python forecasting-service/qa/rolling_backtest.py --months 6 --max-products 50 |
  Tee-Object -FilePath forecasting-service/outputs/qa-backtest-2025.json
```

To evaluate all available workbook products, use `--max-products 10000`.
The runner prints overall WAPE, MAE, signed bias, a seasonal-naive baseline,
the models actually used, and largest errors. It fails if input is missing,
has invalid periods, or no eligible folds.

## What a successful run **does not** prove

- The train/test split is truly **out of sample**: to predict 2025-07,
  only history strictly earlier than 2025-07 is passed to the actual forecast function.
- The **production SARIMA requires at least 24 completed training months**.
  The 2024-2025 workbooks supply only 24 months total, so the held-out
  2025 folds have 12..23 training months and **must run the seasonal-naive
  fallback**, not SARIMA. A passed report does not certify SARIMA accuracy.
- The 2026 reconstruction workbook is **not actual 2026 sales** and is
  deliberately excluded from the test.
- Source workbook values should be reconciled to real POS/sales records
  before using accuracy metrics as a release gate.
- Inventory/financial correctness and database concurrency require a
  **separate** simulation against an isolated QA MySQL database.

Do **not** run `npm run dev`, `npm run forecast:generate`,
`npm run forecast:smoke`, `npm run prisma:sync:dev`, or any
`--apply` command until the active MySQL database has been positively
identified as an isolated QA target.

This QA harness is designed only for `qa/recommender-oct16`.
Do not merge synthetic test fixtures or results into Sprint 11.
