# DTO Standards

## Purpose

This document defines the future DTO naming and responsibility rules for YsabelleStore API work.

## Scope

- DTO naming
- Validation responsibilities
- Request and response object ownership
- Example DTO names

## DTO Naming Rules

| Rule                               | Example               |
| ---------------------------------- | --------------------- |
| Use PascalCase                     | `CreateProductDto`    |
| End with `Dto`                     | `UpdateInventoryDto`  |
| Use descriptive domain names       | `ForecastRequestDto`  |
| Separate request and response DTOs | `ForecastResponseDto` |

## Example DTOs

| DTO                   | Responsibility                          |
| --------------------- | --------------------------------------- |
| `CreateProductDto`    | Define product creation input           |
| `UpdateInventoryDto`  | Define inventory update input           |
| `ForecastRequestDto`  | Define forecast service request input   |
| `ForecastResponseDto` | Define forecast service response output |

## DTO Rules

- DTOs should describe transport data only.
- DTOs should not contain business logic.
- DTOs should be validated before reaching services.
- DTOs should stay aligned with route contracts and response shapes.

## Future Implementation Notes

- Keep one DTO per clear action or payload shape.
- Use separate DTOs for create, update, and response cases.
- Update DTO documentation when contract fields change.

## Validation Checklist

- [x] Naming rules are documented
- [x] Example DTO names are provided
- [x] Validation responsibilities are clear
- [x] DTOs are kept separate from business logic
