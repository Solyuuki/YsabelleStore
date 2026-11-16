# Sprint 13 Risk Plan

## Release-blocking risks

- **Wrong database target:** QA, local development or a Railway deployment
  must not modify the business production database by accident.
- **Overselling offline:** A disconnected POS and online Storefront cannot both
  sell the same unallocated inventory. Require explicit offline stock governance.
- **Duplicate transactions:** Retry/replay after reconnect must be idempotent,
  durable and receipt/accounting-safe.
- **False installer readiness:** Electron's renderer-only packaging is not
  equivalent to an installable offline backend/MySQL transaction runtime.
- **Trial expiration:** Railway service/billing limits, data persistence,
  billing notifications and exit/restore process require explicit ownership.
- **Database or image loss:** Back up and restore-test both MySQL and persistent
  product media before migration or public launch.
- **Secret exposure:** Never include production DB credentials, API secrets
  or privileged tokens inside the browser, Windows installer or Android APK.
- **Unverified APK/update:** Untrusted downloads, unsigned packages and
  silent mid-checkout updates are prohibited.
- **Breaking API rollout:** Old installer versions must remain supported
  during a documented compatibility window or update must be coordinated.
- **Uncontrolled deployment:** Merging source code is not permission to
  auto-deploy to a live business database without release approval.

## Controls

- Separate staging and production, with isolated records and guarded secrets.
- Mandatory exact-SHA CI, targeted stress tests and real-device smoke testing.
- Approved migrations, backups, restoration and rollback/roll-forward rehearsals.
- Auditable inventory movements and formal conflict remediation; no silent
  direct database edits.
- Preserve known limitations openly in the defense and release documentation.

## Status

Risks documented; their technical controls are not yet proven by this activation.
