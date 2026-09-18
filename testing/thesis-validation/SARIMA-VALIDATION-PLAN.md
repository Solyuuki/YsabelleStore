# SARIMA Thesis Validation Plan

## Objective

Quantitatively answer the thesis question on SARIMA forecasting accuracy using:

- Mean Absolute Error (MAE)
- Mean Absolute Percentage Error (MAPE)
- Root Mean Square Error (RMSE)

## Validation Method

Use chronological hold-out backtesting.

```
older observations -> training set
most recent historical observations -> testing set
training set -> SARIMA fit
SARIMA -> forecast testing period
forecast -> compare with actual testing observations
```

The testing observations must not be used to fit the validation model.

## Required Detailed Output

For every evaluated product-month:

| Field |
| --- |
| Product ID / SKU |
| Product name |
| Month |
| Actual demand |
| Forecast demand |
| Residual = Actual - Forecast |
| Absolute error |
| Squared error |
| Absolute percentage error when Actual > 0 |

## Metrics

```
MAE  = mean(abs(actual - forecast))
RMSE = sqrt(mean((actual - forecast)^2))
MAPE = mean(abs((actual - forecast) / actual)) * 100
```

## Zero-Demand Policy

When actual demand equals zero:

- retain the observation for MAE and RMSE;
- exclude it from MAPE;
- count and report all MAPE-excluded observations.

Do not silently replace zero actual values.

## Product Eligibility

Before execution, define a minimum historical-data requirement. Products that do not meet the requirement must be reported as excluded with the reason.

Do not select only high-performing products for the overall accuracy result.

## Required Generated Artifacts

The future validation script should generate:

```
testing/thesis-validation/evidence/sarima/
  summary_metrics.csv
  product_metrics.csv
  detailed_calculations.csv
  validation_metadata.json
  validation_report.txt
  actual_vs_forecast.png
  residual_plot.png
```

## Chapter 3 Mapping

The generated outputs will support:

- Summary of SARIMA Forecast Accuracy Results
- Actual and Forecasted Monthly Product Demand
- Residual Behavior of the Selected SARIMA Model
- detailed computation proof retained for defense

## Reproducibility Metadata

Record at minimum:

- dataset filename / version;
- input row count;
- eligible product count;
- excluded product count and reasons;
- training coverage;
- testing coverage;
- model-selection method;
- MAPE zero-demand handling;
- Python version;
- package versions where practical;
- Git commit SHA.

No thesis metric should be manually hard-coded.
