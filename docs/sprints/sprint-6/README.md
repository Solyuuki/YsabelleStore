# Sprint 6 Planning Index

Sprint 6 introduces a server-side **Catalog Image Quality Engine (CIQE)** for product-image upload, quality analysis, safe enhancement, normalization, preview, and storefront-safe publishing.

## Sprint Metadata

| Field | Details |
| --- | --- |
| Sprint | Sprint 6 |
| Sprint branch | `sprint/v0.6/sprint-6` |
| Base branch | `sprint/v0.5/sprint-5` |
| Active sprint source | `config/guardrails.json` |
| Primary theme | Automated product-image quality, normalization, and publishing safety |
| Internal service name | `catalog-image-engine` |
| Architecture | Server-side hybrid deterministic processing + optional local vision adapter |
| External paid image API | Not required |
| Product-save policy | Product may save even when a candidate image fails; failed/unapproved image is not promoted to storefront |
| Approval UX | Before/After preview for publishable processed images |
| Repository-side status | Planning/design approved; implementation not started |

## Sprint 6 Goal

A retailer or owner should be able to upload an ordinary real product photo without manually resizing, centering, cleaning, or preparing separate card/detail files. The system should automatically make safe corrections when possible and clearly reject or hold images when the source cannot be truthfully repaired.

## Core Flow

```text
owner uploads product image
        ↓
validate bytes / format / dimensions
        ↓
quality analysis
        ↓
safe deterministic normalization
        ↓
optional local subject/background assistance
        ↓
generate preview + card + PDP variants
        ↓
quality gate
   ┌────┴──────────────┐
APPROVED        NEEDS_REVIEW / REJECTED
   ↓                    ↓
Before/After       product may still save
preview            candidate not published
   ↓                    ↓
owner accepts      placeholder/previous approved image
   ↓
promote approved asset to product
```

## Planning Documents

| Document | Purpose |
| --- | --- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md) | Sprint outcomes, constraints, and non-goals |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md) | Work breakdown and sequencing |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) | Acceptance and verification criteria |
| [`../../superpowers/specs/2026-08-22-catalog-image-quality-engine-design.md`](../../superpowers/specs/2026-08-22-catalog-image-quality-engine-design.md) | Approved architecture/design specification |

## Product Safety Principle

> Enhance and normalize evidence that exists in the uploaded image. Never invent missing product packaging, label text, brand text, flavor, size, ingredients, barcode, or other product facts.

## Scope Boundary

Sprint 6 focuses on the internal upload/processing/publishing pipeline. Barcode-first online image discovery may be added later as a separate extension using explicit source/licensing rules; arbitrary web images are not auto-published by this sprint.
