# Audit Logging Plan

Audit logging will help explain important local actions without tracking unnecessary staff activity. This is a plan only and does not implement audit tables, models, services, or Prisma queries.

## Future Audit Events

| Event                     | Reason                            |
| ------------------------- | --------------------------------- |
| Login                     | Track account access              |
| Logout                    | Track session end                 |
| Product changes           | Explain product master data edits |
| Inventory adjustment      | Explain stock changes             |
| Sales transaction         | Trace sales records               |
| Forecast run              | Trace demand forecast generation  |
| Recommendation generation | Explain system-generated guidance |
| CSV/Excel import          | Track bulk data changes           |

## Planned Audit Fields

| Field       | Purpose                                 |
| ----------- | --------------------------------------- |
| Actor       | Future user who performed the action    |
| Action      | Stable event name                       |
| Entity type | Affected module or record type          |
| Entity ID   | Affected future record identifier       |
| Summary     | Human-readable explanation              |
| Timestamp   | Local event time                        |
| Metadata    | Safe structured details without secrets |

## Audit Boundaries

| Include                          | Exclude                       |
| -------------------------------- | ----------------------------- |
| Business-changing actions        | Password values               |
| Import summaries                 | JWT tokens                    |
| Forecast and recommendation runs | Full raw spreadsheet contents |
| Validation failure counts        | Database URLs                 |
| Inventory adjustment reasons     | Stack traces                  |

## Future Workflow

```text
Sensitive action succeeds
  -> future service creates audit event
  -> audit event stores safe summary
  -> reports can explain what changed and when
```
