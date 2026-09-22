# Sprint 11 — Quality of Life, Stabilization, and Optimization

Sprint 11 starts from the certified Sprint 10 release on `main` and focuses on improving the existing system rather than expanding its core product scope.

## Sprint theme

Quality of Life / Stabilization & Optimization.

## Execution rule

Sprint 10 domain authorities remain the baseline. Sprint 11 changes must be justified by a concrete defect, reliability problem, measurable performance issue, maintainability concern, or user-experience improvement. Existing inventory, receiving, restock, forecasting, POS, storefront, and audit contracts must not be rewritten casually.

## Workstreams

1. Bug and error correction.
2. HTTP/API reliability and consistent error semantics.
3. Global system-health, reconnect, and failure UX.
4. Performance and runtime optimization.
5. User workflow and interface quality-of-life improvements.
6. Technical cleanup, maintainability, and regression hardening.
7. Release verification and manual QA.

## Current active slice

The first active Sprint 11 slice standardizes the HTTP status/transport contract so later reliability UI can react consistently to authentication, authorization, validation, conflict, rate-limit, dependency, timeout, and service-unavailable conditions.

## Integration rule

Task branches target `sprint/v0.11/sprint-11`. Accepted Sprint 11 work is promoted through the established staging and main release path only after relevant automated gates and manual QA pass.

## Migration/canonical-state hardening checkpoint

Phase 4 has reconciled the production-50 image candidates and now pins the exact runtime asset identities for the 50 selected candidate folders (original, processed, card, and PDP variants). Automatic distribution remains fail-closed until the physical runtime payload is published and pull materialization/recovery rehearsals pass; `distributionReady` remains `false`.
