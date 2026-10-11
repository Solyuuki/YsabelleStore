# Sprint 11 Backlog

## Workstream 1 — HTTP/API Reliability

- [x] Identify the current canonical HTTP status contract and real runtime usage.
- [x] Add missing statuses required by existing and planned application semantics.
- [x] Preserve safe 502/503/504 dependency outcomes without exposing internal diagnostics.
- [x] Distinguish 405 Method Not Allowed from 404 Not Found for known API resources.
- [x] Preserve HTTP status and Retry-After metadata in the frontend API client.
- [x] Support 204 No Content as a successful frontend transport response.
- [x] Enforce 415 for unsupported inventory import media.
- [ ] Complete exact-head automated certification and merge the HTTP status slice.

## Workstream 2 — Global Reliability UX

- [ ] Add a root-level system-health provider.
- [ ] Monitor backend readiness, browser online/offline state, focus recovery, and request transport failures.
- [ ] Define Healthy, Degraded, Reconnecting, and Unavailable UI states.
- [ ] Disable unsafe write operations when backend/database readiness cannot be established.
- [ ] Keep appropriate static storefront content available while transactional services are unavailable.
- [ ] Add human-readable UI behavior for 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 502, 503, and 504.
- [ ] Add automatic recovery when service health returns.
- [ ] Add server-down and database-down regression/manual QA scenarios.

## Workstream 3 — Bug and Error Audit

- [ ] Audit open runtime errors, unfinished-code markers, stale UI states, and inconsistent error handling.
- [ ] Prioritize defects by transaction/data-integrity risk and user impact.
- [ ] Add regression coverage before closing each material defect.

## Workstream 4 — Optimization

- [ ] Profile slow or repeated frontend/backend operations before optimizing.
- [ ] Reduce unnecessary API, database, render, and forecast work where measurable.
- [ ] Preserve correctness and observability while optimizing.

## Workstream 5 — UX / QoL

- [ ] Review Staff, Owner, POS, Receiving, Reports, and customer flows for avoidable friction.
- [ ] Improve feedback, loading, empty, success, and recovery states.
- [ ] Keep motion and visual polish purposeful, accessible, and performant.

## Workstream 6 — Release Hardening

- [ ] Run full code/status verification on exact candidate heads.
- [ ] Complete applicable manual browser/Electron QA.
- [ ] Promote only verified Sprint 11 integration through staging to main.

## Sprint Activity Log

- 2026-09-18 — Sprint 11 integration started from the certified Sprint 10 `main` baseline.
- 2026-09-18 — `m1/v0.11/fix/http-status-contract` opened the first QoL slice for HTTP status and transport standardization.
