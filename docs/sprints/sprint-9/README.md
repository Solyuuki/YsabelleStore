# Sprint 9 — Customer Authentication, Account Security & Experience

Sprint 9 strengthens the customer authentication and account experience while preserving the separate OWNER/STAFF authentication realm and the verified Sprint 8 server-safety foundation.

## Execution rule

Sprint 9 is executed phase-by-phase. Each phase must pass its automated verification and applicable manual acceptance gate before integration. Unrelated backend/business-logic changes are out of scope.

## Phase sequence

1. Customer auth security and privacy foundation
2. Username, email, or PH mobile + password authentication
3. Customer login/register visual redesign
4. Customer profile + account security
5. Staff/Owner visual re-theme
6. Google + Facebook authentication
7. Phone OTP + verification
8. Shipping addresses and delivery-contact verification

## Human acceptance rule

Automated checks do not replace manual acceptance for security-sensitive or user-facing auth flows. Phase 2 remains unmerged until the approved customer and Staff/Owner isolation checks are complete and the final exact-head verification is green.

## Baseline

Sprint 9 was created from the Sprint 8 release baseline already promoted into the repository and continues from `sprint/v0.9/sprint-9`. The Phase 2 customer-auth implementation is validated independently before later Phase 3/4 work is integrated.
