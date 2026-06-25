# Input Validation Security

Input validation protects YsabelleStore from invalid local forms, unsafe imports, broken forecast inputs, and accidental data corruption. Zod is the preferred validation direction for TypeScript modules.

## Validation Matrix

| Input Area             | Required Validation Direction                              | Bad Input Example          |
| ---------------------- | ---------------------------------------------------------- | -------------------------- |
| Product forms          | Trim names, require category, validate price and status    | Empty product name         |
| Inventory numbers      | Require non-negative integers and clear unit meaning       | `-5` stock                 |
| Sales quantities       | Require positive quantities and valid sale dates           | `0` quantity sold          |
| Batch expiration dates | Require valid date and clear timezone handling             | `not-a-date`               |
| Forecast inputs        | Require enough historical sales data and valid date ranges | End date before start date |
| CSV/Excel imports      | Validate file type, size, columns, row values, and preview | Missing product identifier |

## Future Zod Pattern

```text
route
  -> validator middleware
  -> controller
  -> service
  -> future data access
```

## Validation Rules

| Rule                   | Standard                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| Reject invalid numbers | No negative stock, negative prices, or invalid quantities        |
| Normalize text         | Trim whitespace and sanitize imported text                       |
| Validate dates         | Use predictable date parsing and reject invalid expiration dates |
| Validate identifiers   | Future IDs must be checked before service logic runs             |
| Return safe messages   | Do not expose stack traces or database details                   |

## Good vs Bad Examples

| Good                                                     | Bad                                   |
| -------------------------------------------------------- | ------------------------------------- |
| Validate a product payload before the controller uses it | Trust frontend form fields            |
| Return row-level import validation errors                | Skip invalid rows silently            |
| Reject malformed dates                                   | Guess dates from ambiguous text       |
| Keep schemas in `validators` or `schemas` folders        | Mix validation rules into route files |
