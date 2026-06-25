# Error Handling Security

Errors must help store staff recover without exposing technical details. Backend logs can keep diagnostic information, but frontend responses must stay safe.

## Error Response Rules

| Rule                                  | Standard                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| No stack traces in frontend responses | Stack traces stay internal                                        |
| No database details                   | Do not expose SQL, Prisma errors, database URLs, or table details |
| No secrets                            | Never include tokens, passwords, or environment values            |
| Safe message style                    | Use clear user-safe messages                                      |
| Internal logging                      | Log technical errors only on trusted backend output               |

## Current Backend Foundation

| Middleware             | Security Role                                              |
| ---------------------- | ---------------------------------------------------------- |
| `notFoundHandler`      | Converts unknown routes into JSON errors                   |
| `errorHandler`         | Returns predictable error responses and logs server errors |
| `securityHeaders`      | Adds lightweight response headers                          |
| `rateLimitPlaceholder` | Establishes a future rate-limit middleware slot            |

## Good vs Bad Examples

| Good                                      | Bad                                            |
| ----------------------------------------- | ---------------------------------------------- |
| `Unexpected server error.`                | `PrismaClientKnownRequestError at mysql://...` |
| `Route not found: GET /api/example`       | Full Express stack trace                       |
| Log technical error internally            | Show filesystem paths in UI                    |
| Return validation details for safe fields | Return raw database error objects              |

## Error Workflow

```text
Application error
  -> central error middleware
  -> safe JSON response
  -> internal technical log when needed
  -> future audit or monitoring event for sensitive actions
```
