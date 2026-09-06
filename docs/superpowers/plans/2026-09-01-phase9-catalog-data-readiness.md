# Phase 9 Catalog Data Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, read-only reconciliation pipeline for the 472 SARIMA source identities and the 430 unique Google Drive image assets, then use the reviewed output to drive safe catalog cleanup and missing-image sourcing.

**Architecture:** Keep historical forecasting identities immutable and produce separate manifest/reconciliation artifacts. Matching is conservative: exact product identity plus compatible variant/size evidence can auto-match; ambiguous, duplicate, and mismatched assets remain review-only. No operational Product, Inventory, InventoryBatch, sales, or forecast-history mutation occurs until the audit is reviewed.

**Tech Stack:** Node.js/TypeScript repository scripts and tests, XLSX workbook parsing using the repository's available dependency stack or a narrowly added parser if required, JSON/CSV audit artifacts, connected Google Drive metadata.

**Spec:** `docs/catalog/phase9-catalog-data-readiness-spec.md`

## Global Constraints

- Branch: `m1/v0.9/feat/catalog-data-readiness`.
- Base: `m1/v0.9/feat/customer-mobile-otp` at `95cd5f618c412916929049fb704878ce69c82d8d`.
- Preserve `P001`-`P472` history and source identities.
- Never invent current price, stock, barcode, variant, or image provenance.
- `InventoryBatch` remains physical stock authority.
- Missing image must not hide an otherwise valid identity.
- No blind delete, duplicate creation, or destructive merge.
- Revalidated Drive baseline on September 1, 2026: 430 unique raw image files using direct folder listings. A temporary 429 count came from the Drive image-search path, which omitted AVIF assets; direct Snacks listing returns 156 files including `Hi-Ho O’Puffly BBQ Snack.avif`.

---

### Task 1: Extract authoritative SARIMA identity manifest

**Files:**

- Create: `scripts/catalog/extractSarimaSourceManifest.ts`
- Create: `scripts/catalog/__tests__/extractSarimaSourceManifest.test.ts`
- Read only: `data/forecasting/historical-sales-2024.xlsx`
- Read only: `data/forecasting/historical-sales-2025.xlsx`
- Generate: `artifacts/catalog/phase9/sarima-source-manifest.json`

**Interfaces:**

- Produces `SarimaSourceIdentity { productCode, sourceName, sourceNameNormalized, yearsPresent }`.
- Produces exactly one row for each `P001`-`P472` identity when annual workbook identities agree.

- [ ] **Step 1: Write failing tests** proving extraction rejects missing codes, duplicate codes with conflicting names, and inconsistent 2024/2025 identity sets; expected valid fixture count is deterministic.
- [ ] **Step 2: Run targeted test** and verify RED because the extractor does not yet exist.
- [ ] **Step 3: Implement minimal workbook parser** that reads identity columns only, normalizes presentation differences without removing variant/size semantics, and validates paired annual identity consistency.
- [ ] **Step 4: Run targeted tests** and verify GREEN.
- [ ] **Step 5: Run extractor against committed workbooks** and assert exactly 472 unique codes from `P001` through `P472` with no identity conflict.
- [ ] **Step 6: Commit** extractor, tests, and generated manifest.

### Task 2: Build Drive image manifest

**Files:**

- Create: `scripts/catalog/buildDriveImageManifest.ts`
- Create: `scripts/catalog/__tests__/buildDriveImageManifest.test.ts`
- Generate: `artifacts/catalog/phase9/drive-image-manifest.json`

**Interfaces:**

- Consumes Drive metadata exported from the connected Google Drive inventory.
- Produces `DriveImageAsset { fileId, filename, folderId, folderName, extension, normalizedStem }`.

- [ ] **Step 1: Write failing tests** for duplicate filenames, different-format duplicates, folder preservation, and preservation of size/flavor tokens in normalized stems.
- [ ] **Step 2: Run targeted test** and verify RED.
- [ ] **Step 3: Implement minimal manifest builder** that preserves file IDs and category folders and emits deterministic ordering.
- [ ] **Step 4: Run targeted tests** and verify GREEN.
- [ ] **Step 5: Export the connected Drive inventory using direct folder listings and assert the manifest contains exactly 430 unique raw image files, including AVIF assets.**
- [ ] **Step 6: Commit** builder, tests, and manifest.

### Task 3: Reconcile 472 source identities against 430 Drive images

**Files:**

- Create: `scripts/catalog/reconcileCatalogImages.ts`
- Create: `scripts/catalog/__tests__/reconcileCatalogImages.test.ts`
- Generate: `artifacts/catalog/phase9/image-reconciliation.json`
- Generate: `artifacts/catalog/phase9/image-reconciliation.csv`
- Generate: `docs/catalog/phase9-image-reconciliation-report.md`

**Interfaces:**

- Consumes `sarima-source-manifest.json` and `drive-image-manifest.json`.
- Produces one source-side outcome per SARIMA identity plus explicit Drive-only/duplicate asset outcomes.
- Status enum: `EXACT_MATCH | NEEDS_REVIEW | VARIANT_SIZE_MISMATCH | DUPLICATE_IMAGE | DRIVE_ONLY | MISSING_IMAGE`.

- [ ] **Step 1: Write failing tests** for exact matches, punctuation/case normalization, size mismatch, flavor mismatch, one source with two equivalent image formats, ambiguous family names, and Drive-only assets.
- [ ] **Step 2: Run targeted test** and verify RED.
- [ ] **Step 3: Implement conservative matcher**. Auto-match only when identifiable brand/product/variant/size evidence is compatible; never resolve a conflict by dropping tokens.
- [ ] **Step 4: Run targeted tests** and verify GREEN.
- [ ] **Step 5: Generate reconciliation artifacts** and report status counts, duplicate groups, misfile candidates, and the exact `MISSING_IMAGE` list.
- [ ] **Step 6: Validate total accounting** so all 472 sources and all 430 unique raw images are represented exactly once in the audit model, except assets intentionally referenced in an explicit duplicate group.
- [ ] **Step 7: Commit** matcher, tests, and report.

### Task 4: Source images for confirmed missing products

**Files:**

- Generate: `artifacts/catalog/phase9/external-image-candidates.json`
- Generate: `docs/catalog/phase9-external-image-review.md`

**Interfaces:**

- Consumes only reviewed `MISSING_IMAGE` rows from Task 3.
- Produces candidate records containing source product code/name, exact candidate identity, source URL, source type, variant/size evidence, and review status.

- [ ] **Step 1: Define review validation tests/fixtures** for rejecting wrong variant, wrong size, generic lookalikes, and absent provenance.
- [ ] **Step 2: Research exact candidates** prioritizing official manufacturer/brand sources, then reputable Philippine retail sources.
- [ ] **Step 3: Record provenance and evidence** without assigning images to operational Products yet.
- [ ] **Step 4: Mark unresolved identities `IMAGE_PENDING`** rather than forcing a bad candidate.
- [ ] **Step 5: Commit** candidate manifest and review report only after evidence is complete.

### Task 5: Apply approved catalog readiness cleanup

**Files:**

- Modify only the catalog/service/schema/mapping files proven necessary by the reviewed audit.
- Add targeted tests beside affected catalog/storefront/inventory modules.

**Interfaces:**

- Consumes approved reconciliation decisions from Tasks 3-4.
- Must preserve historical source mapping and batch-authoritative stock.

- [ ] **Step 1: Write failing tests** for each approved behavior change before production code.
- [ ] **Step 2: Implement the smallest approved readiness changes**, separating identity, commercial/current-price, image, and inventory readiness.
- [ ] **Step 3: Verify missing-image products can remain legitimate catalog identities without becoming falsely purchasable.**
- [ ] **Step 4: Verify no historical price becomes current price and no fake InventoryBatch is created.**
- [ ] **Step 5: Run subsystem and high-risk verification** required by repository context.
- [ ] **Step 6: Commit each independently reviewable cleanup unit.**

## Self-review

- Spec coverage: branch/base, historical preservation, independent readiness states, authoritative Drive count, conservative matching, external sourcing, and no mutation-before-review are covered.
- Placeholder scan: no TBD/TODO implementation placeholders are used.
- Type consistency: Task 3 consumes the exact manifests produced in Tasks 1-2; Task 4 consumes only Task 3 `MISSING_IMAGE`; Task 5 consumes approved Task 3-4 outputs.
