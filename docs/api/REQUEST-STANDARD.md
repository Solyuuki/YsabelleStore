# Request Standard

## Purpose

This document defines the future request format used by YsabelleStore API endpoints.

## Scope

- Headers
- Parameters
- Query
- Body
- Validation philosophy
- Naming rules

## Request Structure

| Part       | Purpose                                      | Rule                                       |
| ---------- | -------------------------------------------- | ------------------------------------------ |
| Headers    | Carry content type, auth, and context values | Keep required headers explicit             |
| Parameters | Identify route resources                     | Use stable route path params               |
| Query      | Filter, paginate, and search data            | Keep query names lowercase and descriptive |
| Body       | Carry create/update payloads                 | Validate every field before use            |

## Validation Philosophy

- Reject invalid input before it reaches business logic.
- Prefer explicit required fields over silent defaults.
- Keep validation close to the boundary that receives the request.
- Return structured errors for invalid payloads.

## Naming Rules

| Rule                    | Example                                      |
| ----------------------- | -------------------------------------------- |
| Lowercase route params  | `:productId`                                 |
| Descriptive query names | `page`, `limit`, `search`                    |
| DTO-aligned body fields | `productName`, `quantity`, `forecastHorizon` |
| No ambiguous aliases    | Avoid short, unclear names                   |

## Example Request Shapes

### Headers

```text
Content-Type: application/json
Authorization: Bearer <token>
```

### Query

```text
/api/v1/products?page=1&limit=10&search=milk
```

### Body

```json
{
  "productName": "Milk",
  "quantity": 12
}
```

## Future Implementation Notes

- Keep request bodies minimal and explicit.
- Keep route params and query names stable after approval.
- Validate data before it becomes part of a DTO or service call.

## Validation Checklist

- [x] Headers are documented
- [x] Parameters are documented
- [x] Query usage is documented
- [x] Body usage is documented
- [x] Validation philosophy is defined
