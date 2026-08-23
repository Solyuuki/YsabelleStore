# Sprint 6 Backlog

## Sprint Theme

Make product-image preparation a system responsibility instead of a retailer image-editing task.

## Work Items

| ID    | Work Item                      | Outcome                                                                                                                     | Status                                                                    |
| ----- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| S6-01 | Image upload contract          | Backend accepts validated product image files with bounded size/type limits                                                 | Implemented; full repo verification pending                               |
| S6-02 | Image storage abstraction      | Original/candidate/approved variants have safe repository-external storage paths and lifecycle rules                        | Implemented; full repo verification pending                               |
| S6-03 | Deterministic quality analyzer | Resolution, decode, orientation, blur proxy, canvas occupancy, edge-contact/crop risk, and aspect diagnostics               | Implemented; CIQE regression verified                                     |
| S6-04 | Safe normalization pipeline    | Auto-orient, contain, center, padding normalization, bounded tonal correction, compression                                  | Implemented; CIQE regression verified                                     |
| S6-05 | Variant generation             | Generate card and PDP derivatives from the processed master without aggressive upscaling                                    | Implemented; CIQE regression verified                                     |
| S6-06 | Image quality model            | Persist processing state, diagnostics, quality status, source/variant metadata, and approved asset pointer                  | Implemented; full repo verification pending                               |
| S6-07 | Product-save publishing rule   | Product may save without a publishable image; rejected/unapproved candidates never replace an approved image                | Implemented; backend verification pending                                 |
| S6-08 | Before/After owner preview     | Add/Edit Product shows original vs processed result and explicit accept/replace action                                      | Implemented; frontend verification pending                                |
| S6-09 | Storefront image policy        | Cards/PDP render approved variant, otherwise previous approved image or placeholder                                         | Implemented; frontend/backend verification pending                        |
| S6-10 | Local vision adapter boundary  | Optional subject/background detector can be plugged in without coupling the baseline engine to one model                    | Implemented; deterministic adapter verified                               |
| S6-11 | Background/subject assistance  | Add local segmentation only if benchmark evidence improves real product framing without fabrication                         | Heavyweight ML not required for Sprint 6; deterministic fallback retained |
| S6-12 | Security hardening             | MIME/magic-byte validation, decompression-bomb limits, filename isolation, safe decode, no executable uploads               | Implemented; full repo verification pending                               |
| S6-13 | Cleanup/lifecycle              | Rejected and superseded candidates are safely retired without deleting an active approved asset                             | Metadata lifecycle implemented; physical retention policy deferred        |
| S6-14 | Regression suite               | Quality classification, no-upscale rule, full-product containment, publishing safety, upload security, replacement behavior | CIQE + backend regression files present; full workspace run pending       |
| S6-15 | Representative image corpus    | Test cans, bottles, sachets, boxes, portrait/landscape sources, blur, clipping, excess whitespace, low-res cases            | Implemented; CIQE corpus verified                                         |
| S6-16 | Performance budget             | Establish acceptable processing latency/memory and prevent large uploads from blocking normal API work                      | Measured and hardened; single-process concurrency gate added              |

## Delivery Sequence

1. Persisted image/storage contract and upload security.
2. Deterministic quality analysis and normalization.
3. Card/PDP derivative generation.
4. Product publishing rules and storefront fallback behavior.
5. Owner Before/After preview.
6. Optional local vision enhancement only after the deterministic baseline is measurable.
7. Full regression/performance/security validation.

## Phase 5 Evidence

See [PHASE-5-VERIFICATION-EVIDENCE.md](PHASE-5-VERIFICATION-EVIDENCE.md) for the observed CIQE regression results, representative corpus coverage, performance measurements, concurrency protection, and the remaining full-repository verification requirements.

## Deferred Extension

Barcode-first online product-image discovery is deliberately outside the core Sprint 6 implementation. If added later, exact identifiers and explicit licensing/source policies must be used; arbitrary search results must never be silently published.

## Sprint Activity Log

| Date       | Member     | Work Item                                                                                                        | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-23 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed | "electron/release-final-test/YsabelleStore Setup 0.1.0.exe.blockmap"<br>"electron/release-final-test/YsabelleStore Setup 0.1.0.exe"<br>"electron/release-verify-2/YsabelleStore Setup 0.1.0.exe.blockmap"<br>"electron/release-verify-2/YsabelleStore Setup 0.1.0.exe"<br>"electron/release-verify/YsabelleStore Setup 0.1.0.exe.blockmap"<br>"electron/release-verify/YsabelleStore Setup 0.1.0.exe"<br>backend/src/controllers/productImageController.ts<br>backend/src/controllers/storefrontController.ts |
