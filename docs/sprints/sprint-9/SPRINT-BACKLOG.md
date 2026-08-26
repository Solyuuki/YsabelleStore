# Sprint 9 Backlog

## Phase 1 — Customer auth security and privacy foundation

- [x] Preserve separate customer and OWNER/STAFF authentication realms.
- [x] Harden customer session, cookie, registration-intent, rate-limit, origin, and safe-error behavior.
- [x] Complete automated and manual acceptance for the security foundation.

## Phase 2 — Username, email, or PH mobile + password

- [x] Add normalized customer username and PH mobile identity support.
- [x] Preserve generic login failures for missing, inactive, and wrong-password accounts.
- [x] Add identity-private login and registration rate-limit buckets.
- [x] Add safe legacy mobile backfill and migration support.
- [x] Complete customer registration/login/session/logout manual QA.
- [x] Complete Staff and Owner isolation manual QA.
- [x] Fix cross-realm internal auth toast presentation leakage.
- [x] Pass local exact-head code verification and pre-push checks.
- [x] Pass GitHub CI and Pull Request Checks on the verified Phase 2 implementation head before governance migration.
- [ ] Pass Repository Governance and full CI on the governance-compliant Phase 2 branch.
- [ ] Mark Phase 2 accepted only after the final compliant exact-head verification is green.

## Phase 3 — Customer login/register visual redesign

- [ ] Redesign customer login and registration surfaces without changing validated Phase 2 auth semantics.
- [ ] Verify responsive, accessible, production-grade customer auth presentation.

## Phase 4 — Customer profile + account security

- [ ] Implement approved profile/account-security scope on top of the accepted Phase 2 baseline.
- [ ] Preserve authentication and session-security invariants.

## Phases 5–8

- [ ] Staff/Owner visual re-theme.
- [ ] Google + Facebook authentication.
- [ ] Phone OTP + verification.
- [ ] Shipping addresses and delivery-contact verification.

## Sprint Activity Log

| Branch                              | Phase   | Status             | Notes                                                                                                       |
| ----------------------------------- | ------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `m1/v0.9/feat/customer-auth-access` | Phase 2 | Final verification | Governance-compliant branch with completed manual QA; awaiting final exact-head green CI before acceptance. |
