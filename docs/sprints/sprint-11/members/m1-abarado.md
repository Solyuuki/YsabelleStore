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

## Product error state validation

CI #1653 passed on implementation head `a46254b427c65fad8448a5c9442123687f7c4a19`, including workspace builds, formatting, linting, typechecking, guardrail tests, aggregate verification, and Phase 6 canonical release hardening. The product error-state polish is ready for manual visual QA.

## Catalog identity and variant readiness

- Extends CSV/XLSX product import with structured `brand`, `variant`, `sizeValue`, and `sizeUnit` fields plus safe aliases and package-size fallback parsing.
- Makes ZIP/Google Drive package imports inherit the same identity contract and exposes variant-ready versus identity-review counts before commit.
- Surfaces variant readiness directly in the Owner Products catalog so incomplete master data is visible without opening every record.
- Publishes canonical catalog release `g2-s2-c4-a2` with a reviewed 50-product identity manifest and evidence-backed package sizes.
- Adds canonical security and regression checks so future catalog releases cannot silently lose brand/variant identity or create one-sided package sizes.

Validation: CI #1693 passed on implementation head `6f148cb3b8fcc76e32608e254e1e71ab67511e51`, including workspace builds, formatting, linting, typechecking, workspace tests, canonical release security, aggregate verification, and Phase 6 release hardening. Ready for manual QA.

## Canonical reconstruction issue tracking

YSB-M1-CANONICAL-MATERIALIZE-007 is tracked from manual QA of the recovered GEN2 database. The current release has complete descriptions and manufacturer barcodes for all 50 canonical products, but reconstruction leaves 47 descriptions and 49 legacy barcode values missing. The barcode registry is not part of the current canonical materialized table set. This remains an open implementation item; no product values should be manually re-entered because the reviewed canonical release is the source of truth.
