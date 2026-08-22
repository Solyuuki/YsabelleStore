# Sprint 6 Phase 5 Verification Evidence

This document records only verification that has actually been observed for the Catalog Image Quality Engine (CIQE). Full repository verification remains required before Sprint 6 can be declared complete.

## Scope

Phase 5 covers deterministic subject/background safety, representative image regression coverage, large-image performance hardening, and process-concurrency protection.

## CIQE Regression Evidence

The current CIQE subsystem was exercised with Python warnings promoted to errors. The focused suite covers quality analysis, normalization, subject detection, the stdin/stdout process contract, and the representative synthetic corpus.

Observed checkpoint after the Phase 5 normalization changes:

- 32 CIQE tests passed.
- No test warnings were accepted as success.
- The representative corpus covers can-like, bottle-like, sachet/landscape, box-like, low-resolution, blurred, excess-whitespace, edge-clipped, complex-background, transparent, and already-normalized sources.
- Complex or uncertain backgrounds preserve the full frame instead of guessing a destructive crop.
- Small sources remain subject to the 1.25x derivative upscale ceiling.
- The processed master is bounded to 1600 px on its longest side; card and PDP variants remain bounded to 480 px and 1000 px respectively.

The repository command `npm run catalog-images:test` is part of `npm run verify:code`, and the backend workspace test command now includes the catalog-image backend regression files.

## Busy-Background Regression

A periodic two-color edge pattern exposed a flaw in the original quality analyzer: median edge deviation could be zero even though a large fraction of the edge was inconsistent with the estimated background.

The quality analyzer now also measures the ratio of strong edge outliers. If more than 25% of edge samples deviate beyond the clean-background tolerance, automatic foreground occupancy is treated as untrustworthy and `BACKGROUND_COMPLEXITY_RISK` is emitted. A dedicated regression test preserves this behavior.

## Performance Evidence

Measurements were collected in the agent Linux execution environment with Pillow 12.3.0. They are engineering evidence, not a substitute for the final Windows/local deployment benchmark.

### 24 MP complex-background case

Input dimensions: 4000 x 6000 (24 MP).

| Revision | Elapsed | Peak RSS | Processed master | Result |
| --- | ---: | ---: | --- | --- |
| Before working-size cap | 15.10 s | ~821 MiB | 6480 x 6480 | `NEEDS_REVIEW` |
| After 1600 px master cap | 6.13 s | ~424 MiB | 1600 x 1600 | `NEEDS_REVIEW` |
| After redundant-copy removal | 5.24 s | ~392 MiB | 1600 x 1600 | `NEEDS_REVIEW` |

The same complex source continued to preserve the full frame and remained review-required throughout the optimization.

### Near-upload-limit compressed case

A generated 4000 x 6000 JPEG measuring approximately 7.55 MiB was processed with the hardened pipeline.

- Elapsed: 6.86 s.
- Peak RSS: ~392 MiB.
- Result: `NEEDS_REVIEW`.
- Processed master: 1600 x 1600.
- Processing remained below the configured 20-second child-process timeout.

## Concurrency Protection

Because one worst-case image process can use roughly 400 MiB in the measured environment, the Node runner now uses a FIFO process gate with one active CIQE Python child per backend instance.

Observed focused gate tests:

- A second heavy job does not enter until the first releases the gate.
- A failed first job still releases the gate and allows the next queued job to run.
- The Python processing timeout begins inside the gated process section, so queue wait time does not consume the 20-second child-process timeout.

The fixed concurrency of one is intentional for Sprint 6 and the small-store deployment profile. It can be made configurable later only if deployment measurements justify higher parallelism.

## Asset Lifecycle Decision

Rejected and superseded image records are retired through status/timestamp metadata, while the active approved asset is protected from in-place rejection. Sprint 6 does not automatically delete rejected or superseded original files because no retention window has been approved and deleting them would reduce audit/recovery value.

A future storage-retention policy should define age, audit requirements, rollback needs, and deletion scheduling before physical cleanup is automated.

## Verification Still Pending

The current agent execution container cannot clone the GitHub repository because outbound GitHub DNS resolution is unavailable. No fresh GitHub Actions run is present for the latest Sprint 6 commits.

Therefore these checks are still required on a full repository checkout before Sprint 6 completion is claimed:

- `npm run prisma:validate`
- `npm run prisma:generate`
- frontend and backend typecheck/lint
- backend workspace test suite with database prerequisites
- existing product-image/cutout/storefront-image regressions
- production build
- production dependency security audit
- `npm run verify:code`
- applicable Sprint 6 pre-push/local guardrail verification

Do not convert these pending checks into completed Definition-of-Done items without fresh command evidence.
