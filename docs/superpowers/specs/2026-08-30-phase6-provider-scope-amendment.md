# Phase 6 Provider Scope Amendment

Date: 2026-08-30
Branch: `m1/v0.9/feat/customer-social-auth`

This amendment supersedes the Facebook-specific requirements in `2026-08-29-customer-social-auth-design.md` for Sprint 9 Phase 6.

## Approved Scope Change

Meta/Facebook authentication is removed from the customer-facing Phase 6 acceptance scope because the project owner elected not to continue the Meta developer onboarding dependency.

Phase 6 customer Quick Sign now consists of:

- `Continue with Google` — functional Phase 6 authentication action.
- `Continue with Mobile OTP` — visible reserved action, disabled and explicitly labeled `Available in Phase 7` until Phase 7 begins.

Phase 7 remains the implementation phase for phone OTP/passwordless mobile authentication and verification. Phase 6 must not implement SMS delivery, OTP issuance, OTP verification, or mobile-passwordless session creation.

## Phase 6 Acceptance Override

Where the earlier design says Google and Facebook are both required, read the Phase 6 requirement as Google only. Facebook live-provider QA is no longer required for Phase 6 acceptance.

All other Phase 6 security requirements remain unchanged, including:

- backend-owned Google OAuth;
- PKCE/state/nonce validation;
- safe existing-customer account linking and duplicate prevention;
- password and recovery regression protection;
- strict CUSTOMER versus OWNER/STAFF isolation;
- secure cookie/session behavior;
- browser and Electron coverage;
- replay/expiry/error handling;
- secret-leak prevention;
- exact-head automated verification.

Existing dormant Facebook backend code or database enum values may remain temporarily if removing them would create unnecessary migration risk, but Facebook must not be exposed as a customer Quick Sign action and is not part of Phase 6 completion criteria.
