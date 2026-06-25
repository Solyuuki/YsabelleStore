# Output Standards

## Purpose

This folder defines the naming and structure expectations for generated forecast artifacts.

## Scope

This document covers output naming conventions only. It does not generate files or compute forecasts.

## Responsibilities

| Responsibility | Description |
| --- | --- |
| File naming | Keep generated artifacts predictable and machine-readable |
| Output clarity | Make it easy for future backend or reporting layers to consume results |
| Artifact separation | Keep raw, tabular, and report outputs distinct |

## Planned Output Files

| File | Purpose |
| --- | --- |
| `forecast.json` | Machine-readable forecast payload |
| `forecast.csv` | Tabular forecast export for analysis or review |
| `forecast_report.json` | Structured report with metadata and forecast summary |

## Naming Conventions

- Use lowercase names.
- Use snake_case for multiword file names.
- Keep output names stable across runs.
- Add date stamps only when multiple retained runs need disambiguation.

## Future Implementation Notes

- Generated files should be written only after validation succeeds.
- Outputs should remain independent from UI or database layers.
- Keep report content focused on forecast results and metadata.

## Validation Checklist

- [x] Output file names are documented
- [x] Naming conventions are defined
- [x] No file generation logic is implemented
- [x] Output scope stays limited to forecasting artifacts
