# Sprint 9 Goal

## Goal

Deliver a production-grade customer authentication and account-security foundation with strong privacy boundaries, predictable customer identity handling, and a modern customer-facing experience without weakening the existing OWNER/STAFF authentication realm.

## Success means

- Customer and internal authentication remain separate in credentials, sessions, routes, and presentation.
- Customer login supports username, email, or Philippine mobile number plus password with normalized identifiers and generic credential errors.
- Registration uniqueness and identity normalization are enforced safely.
- Customer session cookies remain finite, revocable, HttpOnly, and isolated from internal bearer auth.
- Rate limits protect login and registration without exposing raw identity values in limiter keys.
- Customer-facing auth/account UI can evolve without changing validated backend auth semantics unintentionally.
- Every phase has reproducible automated evidence and applicable manual acceptance evidence.
- Sprint 9 branch naming, documentation, and guardrail configuration agree on the active sprint.

## Non-goals

- Do not merge later OAuth, OTP, shipping, or account-redesign work into Phase 2 acceptance.
- Do not replace the OWNER/STAFF authentication engine.
- Do not weaken branch, CI, security, or repository guardrails to make checks pass.
- Do not change POS, inventory, forecasting, or unrelated business behavior as part of auth UI work.
