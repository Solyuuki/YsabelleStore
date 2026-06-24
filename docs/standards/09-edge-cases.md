# Edge Cases

This document lists common risks and required mitigation procedures for YsabelleStore.

## Risk Matrix

| Risk                          | Impact                                     | Solution                                                              |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Build Failure                 | Application cannot be packaged or verified | Read the first failing error, fix root cause, rerun build             |
| Lint Failure                  | Code quality gate blocks PR                | Fix reported file and rule; do not disable rules without approval     |
| Prisma Migration Conflict     | Database schema becomes inconsistent       | Coordinate with m2 and regenerate migration from latest `main`        |
| Branch Conflict               | PR cannot merge                            | Follow merge collision procedure and request owner review             |
| Missing Environment Variables | App fails at startup                       | Validate env at startup and update `.env.example`                     |
| Forecasting Failure           | Recommendation output becomes unavailable  | Return structured failure and show recoverable UI message             |
| API Failure                   | UI cannot load or save data                | Log backend error, return safe JSON response, validate request path   |
| Electron Packaging Failure    | `.exe` cannot be produced                  | Check Electron config, assets, paths, and backend startup assumptions |
| GitHub Actions Failure        | PR blocked                                 | Read failed step, fix issue, rerun after commit                       |

## Mitigation Procedures

| Scenario                              | Procedure                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Build failure after dependency change | Verify package versions, remove unused imports, rerun clean install if needed   |
| Import file has invalid rows          | Reject invalid rows, report row numbers, preserve valid database state          |
| Forecast has insufficient history     | Return no forecast with reason and avoid fake recommendations                   |
| Expiration date is missing            | Reject batch record unless business rule explicitly allows non-expiring product |
| Negative stock appears                | Block transaction and investigate source operation                              |
| Chart data is empty                   | Show empty state instead of broken chart                                        |

## Forecasting Edge Cases

| Edge Case                 | Required Behavior                                        |
| ------------------------- | -------------------------------------------------------- |
| Too few sales records     | Return structured error: insufficient history            |
| Non-seasonal data         | Use documented fallback or flag low confidence           |
| Invalid date intervals    | Reject request before model execution                    |
| Python process timeout    | Stop process and return recoverable failure              |
| Model convergence failure | Log reason and avoid producing misleading recommendation |

## Database Edge Cases

| Edge Case                          | Required Behavior                                         |
| ---------------------------------- | --------------------------------------------------------- |
| Duplicate product name             | Enforce approved uniqueness rule                          |
| Deleted product with sales history | Use inactive status instead of destructive deletion       |
| Migration drift                    | Reset only local development database after team approval |
| Batch stock mismatch               | Recalculate through controlled service logic              |

## Validation Checklist

- [ ] Failure path returns clear message
- [ ] No invalid data is saved
- [ ] Owner is notified for cross-layer failures
- [ ] Tests or manual validation cover the edge case
- [ ] PR documents the risk and resolution
