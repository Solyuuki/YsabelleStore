# Response Standard

## Purpose

This document defines the official response format for YsabelleStore API endpoints.

## Scope

- Success payloads
- Metadata usage
- Response consistency
- Frontend consumption expectations

## Standard Response Shape

```json
{
  "success": true,
  "message": "",
  "data": {},
  "meta": {}
}
```

## Field Definitions

| Field     | Purpose                   | Rule                                      |
| --------- | ------------------------- | ----------------------------------------- |
| `success` | Indicates request outcome | `true` for successful responses           |
| `message` | Human-readable summary    | Keep concise and stable                   |
| `data`    | Primary response payload  | Include the business result here          |
| `meta`    | Supporting context        | Use for pagination, counts, or trace info |

## Response Guidelines

- Return predictable JSON shapes.
- Keep `data` focused on the requested resource.
- Use `meta` for non-core information such as pagination.
- Keep success messages short and informative.

## Example Response

```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "id": "prod_001",
    "productName": "Milk"
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

## Future Implementation Notes

- Keep response shapes consistent across route groups.
- Avoid ad hoc response properties.
- Document any new metadata field before using it widely.

## Validation Checklist

- [x] Standard shape is documented
- [x] Field meanings are defined
- [x] Metadata usage is explained
- [x] Example response is provided
