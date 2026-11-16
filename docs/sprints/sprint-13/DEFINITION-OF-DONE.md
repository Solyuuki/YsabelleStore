# Sprint 13 Definition of Done

Sprint 13 is complete only when the approved deployment candidate is demonstrably
operational and recoverable across the agreed online and offline Retail scope.
An accepted thesis defense is not a substitute for live operational verification.

## Deployment gates

- [ ] Railway configuration reproducibly deploys the exact approved source/artifacts.
- [ ] Frontend, backend, MySQL, Python forecast dependencies and persistent assets work together.
- [ ] Isolated test configuration cannot mutate the business production database.
- [ ] Health/readiness, HTTPS, CORS, environment secrets and callback URLs are verified.
- [ ] Server resource usage, subscriptions, backup retention and trial-expiration plan are recorded.

## Business and synchronization gates

- [ ] Storefront and Retail online access, checkout, Receiving, inventory and reports pass QA.
- [ ] Duplicate retries and concurrent POS/Storefront orders preserve stock integrity.
- [ ] Supported offline Retail transactions survive restarts, disconnections and retries.
- [ ] Local-to-cloud replay is idempotent, auditable and inventory-safe.
- [ ] Actual synchronization delay/consistency boundaries are documented; no false
      instant-consistency promise is made during disconnection.

## Installer and updates

- [ ] Windows Retail package installs/runs on a representative clean target device.
- [ ] Android Retail APK is signed, installed and tested on real phones, including scanner.
- [ ] QR distribution uses a controlled HTTPS download source.
- [ ] API compatibility and signed update/rollback behavior are tested.
- [ ] Staff credentials, secrets and customer data are never bundled into installers.

## Release safety

- [ ] Pre-migration backups and independently tested database/file restores exist.
- [ ] Rollback/roll-forward and incident playbooks are exercised.
- [ ] Exact-head CI, dependency audit, guardrails, formatting, types and builds pass.
- [ ] Operational smoke tests, failure injections, and manual desktop/mobile QA pass.
- [ ] Any known risk is resolved or formally accepted without violating release blockers.
- [ ] Release approval and immutable artifact identities are recorded.

## Validation Status

Sprint activation only: **Pending**. No new hosted deployment, Windows/Android
offline behavior, or final production release is claimed by this document.
