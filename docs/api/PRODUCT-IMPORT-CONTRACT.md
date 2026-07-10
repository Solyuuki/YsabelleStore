# Product Import Contract

## Overview

This document describes the implemented CSV and Excel import contract for Sprint 3 M3 product onboarding.
The contract is owner-only and is used to create products, inventory rows, and initial stock movements in one atomic workflow.

## Endpoints

| Method | Path                            | Access  | Purpose                                                              |
| ------ | ------------------------------- | ------- | -------------------------------------------------------------------- |
| `GET`  | `/api/products/import/template` | `OWNER` | Download the canonical CSV template                                  |
| `POST` | `/api/products/import/preview`  | `OWNER` | Validate a CSV or Excel file without writing data                    |
| `POST` | `/api/products/import`          | `OWNER` | Validate and persist products, inventory rows, and initial movements |

## File Rules

- Supported file types: `.csv`, `.xlsx`, `.xls`
- Maximum upload size: `5MB`
- Maximum data rows: `1,000`
- The upload field name must be `file`
- The first worksheet is used for Excel files
- Spreadsheet formulas are rejected

## Canonical Columns

Required columns:

- `name`
- `sku`
- `category`
- `unit`
- `costPrice`
- `sellingPrice`
- `reorderLevel`
- `initialStock`

Optional columns:

- `barcode`
- `targetStockLevel`
- `status`
- `description`

## Accepted Aliases

| Canonical          | Accepted aliases                                                               |
| ------------------ | ------------------------------------------------------------------------------ |
| `name`             | `product name`, `product_name`, `productname`                                  |
| `sku`              | `product code`, `product_code`, `productcode`, `productsku`                    |
| `barcode`          | `barcode number`, `barcodenumber`                                              |
| `category`         | `category name`, `categoryname`                                                |
| `unit`             | `unit`                                                                         |
| `costPrice`        | `cost price`, `cost_price`, `costprice`                                        |
| `sellingPrice`     | `selling price`, `selling_price`, `sellingprice`                               |
| `reorderLevel`     | `reorder level`, `reorder_level`, `reorderlevel`                               |
| `targetStockLevel` | `target stock`, `target stock level`, `target_stock_level`, `targetstocklevel` |
| `initialStock`     | `initial stock`, `initial_stock`, `initialstock`                               |
| `status`           | `status`                                                                       |
| `description`      | `description`                                                                  |

## Validation Rules

- `name`, `sku`, `category`, `unit`, `costPrice`, `sellingPrice`, `reorderLevel`, and `initialStock` are required
- `sku` must be unique in the file and unique against the database
- `barcode` must be unique when provided
- `category` must match an existing category name or slug
- `unit` must match the Prisma product unit enum
- `status` defaults to `ACTIVE` when omitted
- `targetStockLevel` defaults to `reorderLevel` when omitted
- `description` is optional and is trimmed before saving
- Monetary values are stored to two decimal places
- Negative quantities are not accepted
- Empty rows are ignored
- Duplicate headers are rejected
- Unknown columns are reported as warnings

## Import Behavior

- Preview returns row-level validation details without writing data
- Import is atomic
- Each valid row creates a product record
- Each product creates one inventory row
- Each row with positive `initialStock` creates one `INITIAL_STOCK` movement
- Movement `referenceType` is `PRODUCT_IMPORT`
- Movement `referenceId` is the generated import UUID
- Imported products and inventory are ready for POS lookup and forecasting support

## Response Shape

The preview endpoint returns:

- File metadata
- Detected columns
- Ignored columns
- Row-level validation results
- Global file errors and warnings

The import endpoint returns:

- Import UUID
- File metadata
- Row counts
- Product and inventory creation counts
- Movement creation counts
- Validation warnings

## Sample Files

- Template download: `/api/products/import/template`
- CSV examples: `docs/samples/product-import/*.csv`
- Excel example: `docs/samples/product-import/valid-products.xlsx`

## Related Contracts

- [Product and Inventory Contract](./PRODUCT-INVENTORY-CONTRACT.md)
- [API Contract README](./README.md)

## Notes

- This contract is owner-only.
- Validation errors are returned as preview details for safe correction before import.
- The import format is intentionally strict so the data can feed POS and SARIMA workflows without cleanup steps.
