# ERD Plan

This document describes the planned future database relationships for YsabelleStore. It is a design plan only and does not implement Prisma models, fields, constraints, indexes, or migrations.

## Planned Data Flow

```text
User
  |
  v
Sales
  |
  v
Inventory
  |
  v
Forecast
  |
  v
Recommendation
```

## Domain Flow Diagram

```text
Product
  |\
  | \-- future Sales history
  | \-- future Inventory summary
  | \-- future Batch inventory with expiration context
  |
  `-- future Forecast outputs
          |
          `-- future Recommendation outputs
```

## Planned Entity Responsibilities

| Future Entity  | Planned Responsibility                                  | Relationship Intent                                                       |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| User           | Represents future local system users and accountability | May own or trigger future sales and audit events                          |
| Product        | Represents the item master list                         | Anchors sales, inventory, batch inventory, forecasts, and recommendations |
| Sales          | Represents historical demand records                    | Feeds forecasting and reporting workflows                                 |
| Inventory      | Represents current stock state                          | Supports stock health and recommendation decisions                        |
| BatchInventory | Represents expiration-aware stock groups                | Supports expiry risk reasoning                                            |
| Forecast       | Represents future SARIMA demand output                  | Converts historical sales into demand expectations                        |
| Recommendation | Represents future inventory action guidance             | Combines forecast and inventory signals into explainable outputs          |

## Expected Relationship Direction

| Source    | Target         | Expected Meaning                                                     |
| --------- | -------------- | -------------------------------------------------------------------- |
| User      | Sales          | A future user may record or be associated with sales activity        |
| Product   | Sales          | A future product may have many historical sales records              |
| Product   | Inventory      | A future product may have stock summary data                         |
| Product   | BatchInventory | A future product may have multiple stock batches                     |
| Sales     | Forecast       | Historical sales will provide forecasting input                      |
| Product   | Forecast       | Forecasts will be generated per product or product group             |
| Forecast  | Recommendation | Forecast output will support future recommendation decisions         |
| Inventory | Recommendation | Current and batch stock state will influence recommendation severity |

## Future Relationship Review Checklist

| Review Item                 | Required Decision Before Implementation                        |
| --------------------------- | -------------------------------------------------------------- |
| Cardinality                 | Confirm one-to-one, one-to-many, and optional relationships    |
| Ownership                   | Confirm which entity owns lifecycle changes                    |
| Deletion behavior           | Confirm restrict, cascade, or archive behavior                 |
| Historical records          | Confirm which records must never be physically deleted         |
| Forecast granularity        | Confirm whether forecasts are per product, category, or period |
| Recommendation traceability | Confirm how recommendations link back to their input records   |

## Data Flow Explanation

| Step | Future Flow                                         | Design Purpose                                     |
| ---- | --------------------------------------------------- | -------------------------------------------------- |
| 1    | Product records define what can be sold and stocked | Establishes the master data layer                  |
| 2    | Sales records capture demand history                | Supplies reporting and SARIMA input                |
| 3    | Inventory and batch records capture stock condition | Supports availability and expiry reasoning         |
| 4    | Forecast records estimate future demand             | Converts historical movement into planning signals |
| 5    | Recommendation records explain suggested actions    | Gives users traceable inventory guidance           |

## Out-of-Scope Relationship Areas

| Area                             | Reason                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| Supplier management              | Not part of the current thesis database scope              |
| Purchase orders                  | Procurement workflow is not part of this foundation        |
| Payment integrations             | GCash or payment storage is outside database foundation    |
| Authentication schema            | User model implementation is reserved for a later phase    |
| Physical indexes and constraints | These belong to schema implementation and migration review |
