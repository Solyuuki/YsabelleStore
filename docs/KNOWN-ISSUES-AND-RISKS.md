# YsabelleStore Known Issues and Risk Register

**Last updated:** 2026-08-17  
**Purpose:** Living checklist of confirmed bugs, thesis-critical methodology gaps, implementation risks, and lower-priority issues so they are not forgotten during development and defense preparation.

> Do not mark an item as fixed based only on code changes. Require fresh verification evidence: relevant tests, integration checks, database assertions, statistical validation, or runtime evidence as appropriate.

## Severity legend

- 🔴 **RED — Critical:** Can corrupt business data, invalidate thesis claims, or break a core contribution/workflow.
- 🟠 **ORANGE — Medium:** Important reliability, security, deployment, completeness, or evidence gap. Should be fixed, but not all are immediate data-corruption bugs.
- 🟡 **YELLOW — Small:** Lower-risk traceability, documentation, UX, or maintainability issue.

## Executive summary

The highest-confidence critical findings are:

1. **POS concurrent overselling is a confirmed software bug.** Two simultaneous checkouts can both consume the final physical unit because the POS path lacks a proven MySQL-safe contention protocol.
2. **Current SARIMA MAE/MAPE/RMSE/WAPE are not predictive forecast accuracy.** They are fitted/in-sample diagnostics computed from observations used to fit/select the model.
3. **Forecast refresh persistence can leave the UI on an old active forecast batch.**
4. **Thesis-grade chronological SARIMA validation and diagnostics are incomplete.**
5. **The current replenishment recommendation is not yet inventory-aware enough to represent the intended Inventory Recommender contribution.**

---

# 🔴 RED — Critical

## R-01 — POS concurrent overselling

**Type:** Confirmed software bug / race condition  
**Status:** OPEN

Two concurrent checkout requests can both observe the final sellable unit before depletion and both create valid sales history for the same physical unit.

### Confirmed evidence

- POS checkout uses a Prisma interactive transaction.
- Availability/batch reads are ordinary non-locking reads.
- The POS transaction does not explicitly use `Serializable`.
- Current MySQL isolation observed during acceptance testing was `REPEATABLE-READ`.
- Batch depletion is an absolute update by batch `id` with no `quantityRemaining >= requested` predicate.
- No optimistic version predicate is used.
- No preceding `SELECT ... FOR UPDATE` was found on the checkout allocation path.
- Sale, SaleItem, batch changes, aggregate inventory, and movement writes are atomic inside one transaction, but transaction atomicity does **not** guarantee concurrency safety.

### Risk

Two completed sales can represent one physical unit. Inventory may remain numerically non-negative while sale/allocation/movement history becomes logically inconsistent.

### Required fix direction

Use one explicit MySQL-safe stock contention protocol across POS stock-depletion paths, such as:

- deterministic row locking with `SELECT ... FOR UPDATE` followed by a re-read of authoritative stock;
- atomic conditional decrement with an affected-row check;
- optimistic concurrency with a version predicate;
- or an equivalent proven MySQL-safe strategy.

Keep the entire sale/inventory/movement operation atomic and add bounded retry handling where appropriate.

### Required regression test

Run two genuinely concurrent MySQL-backed checkout requests against one remaining sellable unit and prove:

- exactly one succeeds;
- exactly one fails with insufficient stock/conflict;
- one completed sale remains;
- one sale item remains;
- batch ends at zero;
- aggregate inventory ends at zero;
- exactly one corresponding sale movement exists;
- no partial rows remain from the failed checkout.

**Repository evidence:** `backend/src/services/posService.ts`, `backend/src/services/stockDomainService.ts`, `database/prisma/schema.prisma`, `backend/test/data-flow.test.ts`.

---

## R-02 — SARIMA fitted metrics are not predictive accuracy

**Type:** Confirmed thesis/methodology defect  
**Status:** OPEN

The current SARIMA MAE, MAPE, RMSE, and WAPE are calculated from fitted values produced by models trained and selected using the same 24 observations being scored.

### Risk

These values must not be presented as:

- predictive forecast accuracy;
- holdout accuracy;
- backtest accuracy;
- out-of-sample performance;
- proof that SARIMA beats seasonal naive.

They may only be described as **in-sample fitted-value diagnostics** until a leakage-safe chronological evaluation is performed.

### Required fix direction

Implement a defensible chronological evaluation strategy and compare SARIMA and seasonal-naive on the same unseen targets/origins. Store and report the evaluation protocol and evidence separately from fitted diagnostics.

**Repository evidence:** `forecasting-service/app/sarima.py`, `forecasting-service/app/main.py`, `forecasting-service/app/evaluation.py`, `docs/api/FORECASTING-CONTRACT.md`.

---

## R-03 — Forecast refresh persistence can leave stale active forecasts

**Type:** Confirmed workflow/correctness bug (BR-01)  
**Status:** OPEN

The historical-sales refresh action can report success while bypassing the persisted refresh path, allowing the UI to remain on an older active forecast batch.

### Risk

The user may believe forecasts were refreshed while the system still serves stale persisted results.

### Required fix direction

Route refresh through the persistence-aware forecast refresh pipeline and verify that the active forecast batch changes and survives restart/reload.

---

## R-04 — No proper chronological SARIMA validation for successful SARIMA models

**Type:** Thesis-critical validation gap  
**Status:** OPEN

Successful SARIMA models currently do not have a true chronological holdout/backtest using unseen targets. The seasonal-naive fallback has a chronological 2024→2025 comparison, but active SARIMA models are not evaluated on the same unseen period/origin.

### Risk

The thesis cannot defensibly claim forecast predictive performance from the current fitted metrics.

### Required fix direction

Use a leakage-safe chronological holdout or limited expanding/rolling-origin evaluation appropriate to the short data history, with identical target periods for SARIMA and the baseline.

---

## R-05 — Thesis-described SARIMA diagnostics are missing/incomplete

**Type:** Thesis implementation mismatch  
**Status:** OPEN

The current implementation/audit found the following absent or incomplete for the active SARIMA path:

- ADF stationarity evidence;
- ACF evidence;
- PACF evidence;
- BIC reporting;
- formal residual autocorrelation/whiteness diagnostics;
- residual bias/stability diagnostics;
- empirical interval calibration/coverage.

### Risk

The repository and manuscript can tell different methodological stories during defense.

### Required fix direction

Either implement the approved diagnostics and preserve evidence, or revise manuscript claims only with adviser/panel approval. Do not fabricate results.

---

## R-06 — Replenishment engine is not truly inventory-aware

**Type:** Core thesis feature gap / thesis mismatch  
**Status:** OPEN

Current recommendation behavior is much closer to rounded predicted demand than a true replenishment decision that consumes inventory state and business rules.

### Expected direction

Recommended quantity should consider, when supported by data:

`forecast demand + safety stock - current usable stock - confirmed incoming stock`

and may also need:

- pack/case size;
- minimum order quantity;
- supplier lead time;
- maximum stock;
- expiration risk;
- owner-defined thresholds.

### Risk

This weakens the main thesis contribution: converting validated demand forecasts into actionable inventory recommendations.

---

# 🟠 ORANGE — Medium

## O-01 — No checkout idempotency/command key

**Type:** POS reliability risk  
**Status:** OPEN

Retries or duplicate submissions do not have a confirmed unique command/idempotency key protecting against duplicate sale/movement creation.

---

## O-02 — `Inventory.version` is incremented but not used as a concurrency predicate

**Type:** Concurrency-control gap  
**Status:** OPEN

A version field exists but was not observed being used as a compare-and-update guard on the POS contention path.

---

## O-03 — No dedicated POS concurrency integration test

**Type:** Testing gap  
**Status:** OPEN

Existing POS tests are sequential and do not prove contention behavior against real MySQL transactions.

---

## O-04 — Testing and QA coverage is incomplete

**Type:** Quality/evidence gap  
**Status:** OPEN

Important gaps identified include:

- no committed end-to-end Playwright suite for the main web flows;
- no dedicated Electron E2E suite;
- no POS contention test;
- limited auth/trusted-device security regression coverage;
- limited thesis-grade statistical validation tests;
- no proven coverage thresholds.

---

## O-05 — Web/LAN configuration remains localhost-centric

**Type:** Deployment gap (BR-04)  
**Status:** OPEN

Frontend/API/CORS defaults were observed as localhost-oriented, so another device on the local network cannot be assumed to work without configuration/hardening.

---

## O-06 — Electron installer is not proven fully self-contained

**Type:** Deployment/packaging gap  
**Status:** OPEN

The Electron package does not yet prove end-to-end bundling/operation of the Express backend, MySQL runtime, and Python forecasting runtime.

---

## O-07 — Historical COGS/gross-margin reconstruction may be unreliable

**Type:** Data-model/reporting limitation  
**Status:** OPEN

`SaleItem` stores selling-price information, but immutable batch cost-at-sale was not clearly established. Historical profitability can therefore become fragile unless cost basis is snapshotted or durably reconstructable.

---

## O-08 — Full refund/return financial model is incomplete or unproven

**Type:** Sales workflow gap  
**Status:** OPEN

`VOIDED` exists, but a complete refund/return financial model was not identified during the audit.

---

## O-09 — Automated near-expiry / low-stock notification layer is missing

**Type:** Feature gap  
**Status:** OPEN

Batch/expiry handling exists, but the automated alert/notification layer is incomplete.

---

## O-10 — Supplier approval/order/notification workflow is missing

**Type:** Workflow gap  
**Status:** OPEN

The intended recommendation → owner approval → supplier order/notification chain is not implemented end-to-end.

---

## O-11 — Consumer storefront/order workflow was missing in the audited baseline

**Type:** Feature gap  
**Status:** RECHECK CURRENT BRANCH

The earlier audited baseline did not contain a complete customer shop/cart/checkout/order pipeline. Because storefront development is ongoing, re-audit the current branch before treating this as still missing.

---

## O-12 — SARIMA candidate search is very narrow

**Type:** Modeling limitation  
**Status:** OPEN

Only three fixed SARIMA structures were observed. This can be defensible for a constrained implementation, but it does not by itself match a broader ADF/ACF/PACF-informed parameter-selection claim.

---

## O-13 — Model convergence is recorded but not strictly required for selection

**Type:** Modeling risk  
**Status:** OPEN

A selected candidate may be retained with a warning instead of automatically falling back when convergence is not achieved.

---

## O-14 — Forecast intervals are not empirically calibrated

**Type:** Statistical validation gap  
**Status:** OPEN

Current intervals are nominal model-based intervals (80% in the audited implementation). Empirical coverage and interval width/calibration are not currently demonstrated.

---

## O-15 — Only 24 monthly observations / two annual seasonal cycles

**Type:** Data limitation  
**Status:** KNOWN LIMITATION

Two seasonal cycles are weak evidence for estimating annual seasonality and make conventional train/test splitting difficult. This is not a code bug, but it materially limits what can be claimed.

---

## O-16 — MAPE zero-demand handling needs explicit disclosure

**Type:** Statistical/reporting issue  
**Status:** OPEN

Zero-actual months are excluded from MAPE computation. The number of excluded observations and impact should be surfaced when reporting MAPE.

---

## O-17 — SARIMA and seasonal-naive are not compared on the same unseen window

**Type:** Methodology gap  
**Status:** OPEN

Baseline evidence and SARIMA fitted diagnostics currently use different evaluation logic. A fair comparison requires identical origins, targets, and horizons.

---

## O-18 — Python dependency versions are not fully pinned

**Type:** Reproducibility issue  
**Status:** OPEN

Thesis results can become harder to reproduce if `statsmodels`/scientific dependencies change between runs.

---

## O-19 — Historical Sales is not covered by current global search actions

**Type:** Functional gap (BR-05)  
**Status:** OPEN

Global search does not currently include Historical Sales actions/content in the audited baseline.

---

## O-20 — Rate limiting is a placeholder rather than enforced protection

**Type:** Security hardening gap  
**Status:** OPEN

The audited rate-limiter behavior was described as policy/header foundation rather than an actual enforced request limit.

---

## O-21 — JWT stored in renderer `localStorage`

**Type:** Security risk  
**Status:** OPEN

Renderer XSS would have greater impact when bearer credentials are accessible from `localStorage`. Review the final desktop/web authentication threat model before release.

---

## O-22 — Trusted-device records have no confirmed expiry

**Type:** Security/session-management gap  
**Status:** OPEN

Long-lived trusted-device authorization should have explicit expiry/revocation semantics.

---

## O-23 — No confirmed Content-Security-Policy in backend security headers

**Type:** Security hardening gap  
**Status:** OPEN

Add/review CSP where compatible with the final Electron/browser architecture and test it instead of assuming the policy is harmless.

---

## O-24 — Import and Electron IPC boundaries need stronger abuse-case tests

**Type:** Security/robustness gap  
**Status:** OPEN

Important cases to verify include:

- formula injection in exported/imported spreadsheet values;
- oversized/resource-exhaustion imports;
- parser failures and content-type mismatch;
- main-process IPC payload-shape validation;
- secret/token/PII leakage in logs and error responses.

---

# 🟡 YELLOW — Small

## Y-01 — Multi-batch sale movement traceability is incomplete

**Type:** Audit/traceability issue (BR-06)  
**Status:** OPEN

A sale spanning multiple batches was reported as recording only the first batch identifier on the movement record. Totals may still reconcile, but audit traceability is weaker than the physical allocation history.

---

## Y-02 — README/route/status documentation contains stale information

**Type:** Documentation issue (BR-07)  
**Status:** OPEN

Some repository documentation and route metadata lag behind implementation and newer thesis/project direction.

---

## Y-03 — Guided walkthroughs are not implemented

**Type:** UX enhancement gap  
**Status:** PLANNED

Optional customer/owner/staff guided tours are planned but are not a correctness blocker.

---

# Priority repair order

## P0 — Fix before strong thesis/production claims

1. **R-01 POS concurrency/overselling**
2. **R-03 Forecast refresh persistence**
3. **R-02 + R-04 + R-05 SARIMA validation/diagnostic alignment**
4. **R-06 Inventory-aware replenishment engine**

## P1 — Reliability, security, deployment, and complete workflow

- Checkout idempotency/concurrency regression coverage
- Auth/security hardening
- Broader automated/E2E testing
- Web/LAN readiness
- Supplier/replenishment action workflow
- Customer order integration where in approved scope
- Historical cost/profitability model

## P2 — Evidence, traceability, UX, and documentation polish

- Global search completeness
- Multi-batch movement traceability
- Guided walkthroughs
- Documentation/status cleanup
- Dashboard/report polish

---

# Closure rule

For every closed item, record:

- fix commit/PR;
- affected files;
- test or validation command;
- result/evidence;
- any migration/data impact;
- manuscript/docs section updated if the issue changes a thesis claim;
- date closed.

Do not delete closed items. Mark them **RESOLVED** and keep the evidence so the register can support thesis defense and regression review.
