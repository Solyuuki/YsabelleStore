# Status Codes

## Purpose

This document defines official HTTP status code usage for YsabelleStore API responses.

## Scope

- Success codes
- Client error codes
- Conflict and validation codes
- Server and service error codes

## Status Code Matrix

| Code  | Use                                             |
| ----- | ----------------------------------------------- |
| `200` | Successful read or update response              |
| `201` | Resource created successfully                   |
| `204` | Successful request with no response body        |
| `400` | Malformed or invalid request                    |
| `401` | Authentication required or failed               |
| `403` | Authenticated user is not allowed               |
| `404` | Resource not found                              |
| `409` | Request conflicts with current state            |
| `422` | Request is well-formed but semantically invalid |
| `500` | Unexpected internal server failure              |
| `503` | Required service is unavailable                 |

## Usage Rules

| Situation                      | Status                                       |
| ------------------------------ | -------------------------------------------- |
| Valid GET request              | `200`                                        |
| Successful create              | `201`                                        |
| Deleted resource with no body  | `204`                                        |
| Invalid payload                | `400` or `422` depending on validation stage |
| Missing login                  | `401`                                        |
| Insufficient permission        | `403`                                        |
| Missing record                 | `404`                                        |
| Duplicate or conflicting state | `409`                                        |
| Forecast service unavailable   | `503`                                        |

## Future Implementation Notes

- Keep status choices consistent across all route groups.
- Use `422` for semantic validation that passes basic parsing.
- Reserve `500` for unexpected failures.

## Validation Checklist

- [x] Success codes are documented
- [x] Client error codes are documented
- [x] Server and service codes are documented
- [x] Usage rules are clear
