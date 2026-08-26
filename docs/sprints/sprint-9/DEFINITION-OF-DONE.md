# Sprint 9 Definition of Done

Sprint 9 is complete only when all applicable conditions below are satisfied.

## Authentication correctness

- Customer username, email, and Philippine mobile identifiers follow the approved normalization and uniqueness rules.
- Missing accounts, inactive accounts, and wrong passwords expose the same safe public credential failure.
- Customer sessions remain finite, revocable, cookie-based, and separate from OWNER/STAFF bearer authentication.
- Registration and login protections do not expose raw sensitive identity values unnecessarily.

## Realm isolation

- Customer routes do not inherit internal Staff/Owner authentication presentation or authorization state.
- Internal routes preserve their own session behavior and do not accept customer-session credentials.
- Customer auth API requests do not receive internal bearer credentials from the frontend boundary.

## Change safety and verification

- Behavior changes use focused regression coverage and root-cause debugging for failures.
- Formatting, lint, typecheck, guardrail tests, workspace tests, builds, Prisma validation, dependency audit, and relevant security checks pass on the exact accepted head.
- Security-sensitive and user-facing auth flows receive manual acceptance where required.
- Later phase work is not treated as evidence for an earlier phase unless it is explicitly rebased and reverified.

## Repository governance

- `config/guardrails.json`, Sprint 9 documentation, and `v0.9` branch naming agree on the active sprint.
- Required Sprint 9 documentation is present and non-empty.
- Governance rules are satisfied without bypasses or weakened validation.
- Sprint/phase integration requires explicit user approval after verification.

## Validation Status

| Phase      | Status                    | Acceptance gate                                                                                                  |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Phase 1    | Accepted                  | Security/privacy foundation verified.                                                                            |
| Phase 2    | Final verification        | Customer and Staff/Owner manual QA complete; final exact-head CI and governance must be green before acceptance. |
| Phases 3–8 | Not accepted in this gate | Verified separately in their own phase branches and acceptance cycles.                                           |
|            | Passed                    |                                                                                                                  |
|            | Passed                    |                                                                                                                  |
