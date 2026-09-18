# Sprint 11 — M1 Abarado

## Scope

M1 owns integration-facing Quality of Life, reliability UX, HTTP/API standardization, bug fixing, optimization, and release evidence for Sprint 11.

## Current activity

Branch: `m1/v0.11/fix/http-status-contract`

- Completes the canonical HTTP status set required by current application behavior.
- Adds 405 Method Not Allowed handling without weakening 404 semantics.
- Preserves sanitized 502/503/504 dependency outcomes.
- Preserves HTTP status and Retry-After metadata for frontend consumers.
- Adds 204 client handling and 415 inventory-import enforcement.
- Adds focused regression coverage before the global reliability UI workstream.
