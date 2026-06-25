# Test Naming

## Purpose

This document defines the test naming conventions for YsabelleStore.

## Scope

- File naming
- Naming philosophy
- Language-specific naming expectations

## Naming Philosophy

| Principle         | Description                                            |
| ----------------- | ------------------------------------------------------ |
| Match the source  | Test files should clearly map to the code they protect |
| Describe behavior | Names should explain the scenario and expectation      |
| Stay consistent   | Use one naming pattern within each language            |

## Naming Examples

| Example                        | Meaning                                          |
| ------------------------------ | ------------------------------------------------ |
| `product.service.test.ts`      | Backend service test file                        |
| `inventory.controller.test.ts` | Backend controller test file                     |
| `forecast.service.test.py`     | Forecast service validation or service test file |

## Naming Rules

- Use lowercase file names.
- Keep the subject domain first.
- Use `.test` for test files in TypeScript and Python conventions.
- Prefer a stable suffix pattern that tools can discover easily.

## Future Implementation Notes

- Keep naming aligned with the code module and the layer it belongs to.
- Avoid vague names like `test1` or `sample-test`.
- Update naming guidance if a new language layer is introduced.

## Validation Checklist

- [x] Naming examples are documented
- [x] Naming philosophy is clear
- [x] Language-specific guidance is provided
- [x] No actual test files are added
