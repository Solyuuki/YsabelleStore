# Sprint 11 — M1 Abarado

## Scope

M1 owns integration-facing Quality of Life, reliability UX, HTTP/API standardization, bug fixing, optimization, and release evidence for Sprint 11.

## Current activity

Branch: `sprint/v0.11/sprint-11`

- Adds a premium image-backed size selector to the existing storefront product-detail layout without redesigning the PDP.
- Treats each size as its own real product record, so image, price, stock, SKU/barcode identity, quantity limits, and cart behavior remain product-specific.
- Groups size siblings conservatively by normalized product family name plus brand and variant identity.
- Uses structured `sizeValue`/`sizeUnit` when available and the existing canonical size parser as a safe fallback.
- Shows only storefront-visible size siblings with sellable stock and sorts mixed package units by normalized ascending size.
- Keeps different flavor/formula variants separate even when package sizes match.
- Uses accessible native radio selection, horizontal overflow/scroll-snap on narrow screens, product thumbnails, and the existing Ysabelle visual tokens.
- Adds backend ordering/filtering coverage and a storefront UI contract guardrail.

- Polishes the product-load error state into a compact storefront card with safe customer copy, stronger typography hierarchy, deliberate spacing, responsive actions, and no raw backend URL exposure.

## Validation status

CI #1635 passed on implementation head `b2f0ac6954e19e15857ab320b2b99b697e9389cd`, including formatting, linting, typechecking, workspace tests/builds, guardrail tests, aggregate read-only verification, and Phase 6 canonical release hardening. The implementation is ready for manual visual QA.
