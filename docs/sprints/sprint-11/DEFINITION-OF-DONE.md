# Sprint 11 Definition of Done

Sprint 11 work is complete only when the implementation, regression evidence, safety behavior, and applicable manual QA agree on the exact committed head.

## Reliability and integrity

- Existing Sprint 10 Product, Inventory Batch, Inventory Movement, Restock, Receiving, Forecast, POS, and Storefront authorities remain intact unless an approved defect fix explicitly changes a contract.
- Unexpected server errors remain sanitized.
- Authentication and authorization failures remain distinct.
- User-visible recovery behavior does not imply a write succeeded unless the backend confirms it.
- Optimizations do not bypass canonical stock, audit, or transaction paths.

## HTTP/API acceptance

- The canonical HTTP status set matches real application behavior.
- Known API resources return 405 for unsupported methods while unknown resources remain 404.
- Unsupported media, validation, conflict, rate-limit, service-unavailable, upstream-failure, and timeout semantics are distinguishable where applicable.
- Frontend transport retains status metadata required for contextual UI behavior.
- 204 responses do not produce false client errors.

## Validation Status

Before a Sprint 11 task is accepted, the exact branch head must pass the applicable repository gates:

- Prisma generation and schema validation.
- Guardrail preflight.
- Formatting and lint.
- Repository/workspace typecheck.
- Guardrail and repository-context tests.
- Backend and frontend regression tests.
- Forecasting/catalog-image tests where applicable.
- Production build.
- Production dependency security audit.
- Version consistency.
- Sprint and implementation-artifact status verification.
- GitHub CI, Pull Request Checks, and Repository Governance.

Manual QA is additionally required for changed user-facing workflows, failure/recovery states, and transactional safety behavior.
