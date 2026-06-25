# Error Standard

## Purpose

This document defines the official error format for YsabelleStore API endpoints.

## Scope

- Validation errors
- Authentication errors
- Authorization errors
- Business errors
- Internal server errors
- Forecasting service errors

## Standard Error Shape

```json
{
  "success": false,
  "message": "",
  "error": {
    "code": "",
    "details": ""
  }
}
```

## Error Categories

| Error Type                | Meaning                                       | Example Code              |
| ------------------------- | --------------------------------------------- | ------------------------- |
| Validation error          | Request data failed validation                | `VALIDATION_ERROR`        |
| Authentication error      | User identity could not be verified           | `UNAUTHORIZED`            |
| Authorization error       | User lacks permission for the action          | `FORBIDDEN`               |
| Business error            | Domain rule prevented the action              | `BUSINESS_RULE_VIOLATION` |
| Internal server error     | Unexpected application failure                | `INTERNAL_SERVER_ERROR`   |
| Forecasting service error | Forecast service request or processing failed | `FORECAST_SERVICE_ERROR`  |

## Error Rules

- Return a safe message to the caller.
- Keep technical details inside logs or internal diagnostics.
- Use stable error codes so the frontend can handle them predictably.
- Do not expose stack traces to clients.

## Example Error

```json
{
  "success": false,
  "message": "Invalid request",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": "quantity must be greater than 0"
  }
}
```

## Future Implementation Notes

- Keep error codes stable once public.
- Map backend and forecasting failures into the same contract style.
- Keep error detail text concise and actionable.

## Validation Checklist

- [x] Error shape is documented
- [x] Error categories are listed
- [x] Safe error handling rules are defined
- [x] Forecasting service errors are included
