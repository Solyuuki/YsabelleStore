# Coverage Standards

> **Current baseline:** `sprint/v0.10/sprint-10`

## Purpose

This document defines how YsabelleStore evaluates behavioral test coverage. The repository has substantial implemented automated tests, but it does **not** currently define a numeric line/branch/function coverage threshold through a committed coverage tool. Therefore, percentage claims must not be invented.

## Coverage Priorities

| Module Group | Priority | Required Coverage Focus |
| --- | --- | --- |
| Authentication / security | Critical | Login/session boundaries, authorization, recovery, OAuth/OTP, rate limits, safe errors |
| Inventory / stock truth | Critical | Stock-in/out, movements, batches, receiving, reconciliation, oversell/consistency boundaries |
| POS / sales | Critical | Product lookup, checkout, inventory effects, transaction persistence |
| Data imports | Critical | File validation, preview/confirm, duplicates/overlaps, rollback/recovery behavior |
| Forecasting | Critical | Input preparation, SARIMA/fallback output, failure behavior, metrics and delivery contracts |
| Restock / recommendations | High | Lifecycle transitions, role controls, recommendation decision boundaries, receiving effects |
| Storefront / customer account | High | Catalog delivery, order creation, auth/account/session behavior |
| Catalog / image quality | High | Identity, barcode mapping, quality states, image processing/approval/delivery |
| Reliability / observability | High | Health, liveness/readiness, HTTP status contract, request ID and safe logging |
| Utility / helper code | Medium | Meaningful edge cases for reusable logic where regression risk justifies tests |
| Build/repository guardrails | High | Version/status/format/lint/type/build and repository governance constraints |

## Evidence Model

Coverage is evaluated using multiple evidence types rather than one metric:

| Evidence | Current Mechanism |
| --- | --- |
| Backend behavior/security | `backend/package.json` Node/TS test suite |
| Frontend contracts | `frontend/package.json` TypeScript contract scripts |
| Forecasting | `python -m pytest forecasting-service/tests` |
| Repository guardrails | `npm run test:guardrails` plus preflight/status/version scripts |
| Static quality | Prettier, ESLint, TypeScript |
| Schema/data boundary | Prisma validation and disposable CI MySQL database |
| Buildability | Root and per-workspace builds |
| Security dependency reachability | `npm run security:audit:production` |
| Manual acceptance | Target-machine/runtime workflow verification |
| Accessibility/HCI | Separate manual/tool-assisted evidence; not currently a CI coverage percentage |

## Numeric Coverage Policy

Current status: **no committed numeric code-coverage threshold is enforced**.

Until a coverage tool and threshold are explicitly configured:

- Do not claim 80%, 90%, 100%, or any other line/branch/function coverage value.
- Do not use test-file count as a substitute for measured code coverage.
- Do not treat a green CI run as proof that every code path is tested.
- Prefer documented risk-based behavior coverage for critical workflows.

If numeric coverage is added later, the repository should record the tool, included/excluded paths, metric types, thresholds, CI enforcement and baseline report format in the same change.

## Release Coverage Rule

A release candidate should demonstrate coverage of critical behavior relevant to its changes. For high-risk changes, targeted regression evidence is required in addition to the general CI suite.

Examples:

- Authentication changes require auth/security and affected HTTP tests.
- Inventory changes require stock-truth/receiving/import/reconciliation tests as applicable.
- Forecasting changes require Python forecast tests plus delivery/input/fallback contracts as applicable.
- Packaging/deployment changes require build/package checks and target-machine smoke testing.

## Related Documentation

- [`README.md`](README.md)
- [`TEST-AND-QA-REGISTER.md`](TEST-AND-QA-REGISTER.md)
- [`../deployment/RELEASE-VERIFICATION-MATRIX.md`](../deployment/RELEASE-VERIFICATION-MATRIX.md)

## Maintenance Rule

Update this document whenever the repository adds/removes a coverage tool, changes critical subsystem priorities, or introduces a CI-enforced numeric threshold.
