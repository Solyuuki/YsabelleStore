# Sprint 13 — M1 Abarado

## Scope

Railway-hosted UI acceptance, Windows Retail installer experience, Android Retail
APK and QR distribution, mobile scanner permissions, dark/light and device QA.

## Current Sprint Activity

- 2026-10-15: Sprint 13 activated from `main` at `be5accbaf088aff3e9f5d1bb146561752335396b`.
- Integration branch: `sprint/v0.13/sprint-13`.
- Implementation and manual acceptance evidence: pending.

## Next QA

Verify browser-based Retail and Storefront access after an isolated Railway
deployment; validate signed Windows/Android packages on actual devices.

## Gmail Support Reply and Retry Repair — 2026-10-16

- Working branch: `m1/v0.13/fix/support-email-thread-retry`.
- Task: YSB-M1-SUPPORT-EMAIL-013; target integration branch: `sprint/v0.13/sprint-13`.
- Implementation: restrict outbound Gmail reply parent to the ticket's canonical thread; provide allowlisted provider error diagnostics without revealing tokens or raw error payloads; report retry delivery outcome accurately.
- Code and tests: `backend/src/services/supportGmailService.ts`, `backend/src/controllers/staffSupportController.ts`, `backend/test/support-gmail.test.ts`.
- Automated validation: `npm run verify:code` passed in GitHub Actions CI run 38894283539 for the working branch; `npm run verify:status` identified the missing sprint activity documentation updated by this entry.
- Manual acceptance: pending on live support staff reply, closure email receipt, and retry state (must not assume a customer received a failed message).
- Note: Production Railway configuration and credentials are unchanged by this documentation update.

## UAT F01-F05 Compatibility and Dependency Security — 2026-10-31

- Working branch: `m1/v0.13/fix/uat-compatibility-and-usability`; target integration branch: `sprint/v0.13/sprint-13`; pull request #62.
- Scope: F01 dark retail sidebar contrast; F02 mobile product/recovery sizing; F03 checkout density; F04 desktop login scaling; F05 navigation and checkout wording.
- Security remediation: patched production-reachable Electron, Multer, Zod, DOMPurify, body-parser, and undici; retained existing Zod validation semantics via `zod/v3`. No audit checks were weakened or suppressed.
- Automated evidence: GitHub Actions CI run 41203142003 on code/documentation head `45fd1e8c3cba675555548d700f94a8ccf4ef3a53` passed formatter, linter, typecheck, workspace/guardrail/forecasting tests, build, `npm run security:audit:production`, and `npm run verify:code`; the final status verification stopped because this member sprint activity was not yet documented.
- Status: implementation committed and automated validations above passed. Manual browser/device screenshots, tester recheck for F01-F05, and maintainer merge approval remain pending.
