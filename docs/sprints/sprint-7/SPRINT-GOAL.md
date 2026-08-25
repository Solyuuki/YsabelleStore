# Sprint 7 Goal

Deliver a production-ready authentication foundation for YsabelleStore that supports both internal OWNER/STAFF access and optional public customer accounts without crossing trust boundaries.

## Success criteria

Sprint 7 is successful when:

- Internal OWNER/STAFF authentication remains protected and role-gated.
- Customer accounts use a dedicated persistence and session model.
- Customer registration, login, session restore, and logout are verified end to end.
- Customer sessions are finite, revocable, and transported through secure HttpOnly cookies.
- Customer credentials cannot authorize internal admin or staff APIs.
- Internal credentials cannot be reused as customer sessions.
- Guest browsing and guest checkout continue to work.
- Authenticated customer orders can be associated with the signed-in customer without trusting a client-supplied customer ID.
- Customer-facing login, registration, account, and order-history UI is added only after the backend security boundary is green.
- Sprint 7 guardrails, tests, typecheck, and build complete successfully before the sprint is considered done.
