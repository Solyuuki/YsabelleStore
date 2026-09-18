# Thesis SARIMA Validation Data

The thesis validator consumes an exported effective monthly-sales CSV produced from the same canonical sales source used by the forecasting pipeline.

Generate it from the repository root:

```bash
npm run thesis:sarima:export
```

The generated CSV is intentionally not committed by default because it may contain store operational data.

Expected columns:

- `product_id`
- `product_name`
- `category`
- `period` in YYYY-MM format
- `quantity_sold`
- `source`
- `eligibility_status`
- `eligibility_reason`
- `observation_count`
- `zero_months`

The export uses completed effective sales only. Imported historical sales provide the historical baseline and completed POS sales are authoritative for months where verified POS actuals exist.


## System Evaluation Data

The System Evaluation calculator uses two local files that are intentionally not committed with real respondent data:

- `system_evaluation_responses.csv`
- `system_evaluation_config.json`

Start from the committed templates:

- `system_evaluation_responses.template.csv`
- `system_evaluation_config.template.json`

The response CSV columns are:

- `respondent_id`
- `criterion`
- `item`
- `rating`

The configuration must be copied from the approved System Evaluation Tool and scoring guide. Do not invent or retroactively adjust the scale, verbal interpretation bands, or acceptance threshold after seeing the results.
