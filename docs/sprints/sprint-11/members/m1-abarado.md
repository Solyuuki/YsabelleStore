# Sprint 11 — M1 Abarado

## Scope

M1 owns integration-facing Quality of Life, reliability UX, HTTP/API standardization, bug fixing, optimization, and release evidence for Sprint 11.

## Current activity

Branch: `m1/v0.11/fix/cie-white-catalog-canvas`

- Standardizes CIQE processed, card, and PDP derivatives on one opaque pure-white catalog canvas.
- Aligns the storefront product-media surface with the same pure-white background.
- Preserves original uploads and the existing conservative subject-detection and full-frame fallback behavior.
- Adds regression coverage for off-white opaque sources and transparent product sources.
- Keeps product aspect ratio, contain behavior, derivative sizing, and the 1.25× upscale cap unchanged.
- Adds a cross-layer guardrail so CIE and storefront background policy cannot silently drift.
- PR #45 remains blocked from integration until the exact-head automated checks are fully green.

## Validation status

Automated validation is required to pass on the exact PR head before integration.
