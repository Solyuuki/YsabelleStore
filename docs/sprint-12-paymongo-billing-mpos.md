# Sprint 12 — PayMongo Billing + mPOS

## Branch contract

- Owner/member: M3
- Branch: `m3/v0.9/feat/paymongo-billing-mpos`
- Base: `m1/v0.9/feat/catalog-data-readiness`
- Change type: `feat`
- Purpose: PayMongo-backed billing with mPOS payment coverage

## Delivery method

Sprint 12 uses a phased implementation method. Each phase must be independently verifiable before the next phase changes production-facing behavior.

1. **Phase 1 — Billing foundation**
   - payment-domain boundaries and configuration
   - test/sandbox-first PayMongo integration surface
   - secret-safe environment configuration
   - no regression to existing cash POS checkout
2. **Phase 2 — PayMongo payment flow**
   - create and track external payment state
   - map provider state to internal billing state
   - idempotent request/retry behavior
   - explicit failure and cancellation handling
3. **Phase 3 — mPOS coverage**
   - integrate digital payment selection into the mPOS checkout path
   - preserve existing stock allocation and sale integrity invariants
   - ensure a sale is finalized only according to the approved payment-state rule
4. **Phase 4 — Reconciliation and hardening**
   - provider event/webhook handling and verification
   - payment/sale reconciliation and auditability
   - regression, integration, security, and failure-path verification

## Implementation guardrails

- Never commit PayMongo secrets or live credentials.
- Keep the existing cash checkout path operational unless a phase explicitly changes it.
- External payment retries must not create duplicate internal sales or duplicate payment records.
- Payment state transitions must be auditable and deterministic.
- Inventory/POS integrity checks are Tier 3 verification for this work.
- Current source, schema, migrations, tests, executable configuration, and approved current guidance remain authoritative.

## Completion rule

Do not mark Sprint 12 billing/mPOS work complete until the requested behavior exists, relevant invariants hold, targeted checks pass, full required POS/payment verification passes, and no known introduced issue remains unresolved.
