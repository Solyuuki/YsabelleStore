# Sprint 13 Backlog

## 1. Deployment foundation (Railway first)

- [ ] Confirm Railway account/trial limits, data-retention policy and ongoing-hosting plan.
- [ ] Choose service layout and exact production build/start commands for frontend, API and Python.
- [ ] Provision isolated Railway MySQL; enforce TLS, private connectivity and least-privilege secrets.
- [ ] Configure production CORS, public API URL, customer OAuth, email and payment sandbox callbacks.
- [ ] Configure persistent catalog-image storage; verify media delivery and backups.
- [ ] Automate safe migration checks and backup-first upgrades without force-reset or dev seed.
- [ ] Set approval-controlled deployment from exact Git SHA and health/readiness probes.
- [ ] Test Storefront and authorized Retail browser access from desktop and mobile.
- [ ] Exercise POS/Storefront concurrent checkouts, retries, duplicate requests and stock truth.
- [ ] Validate forecast Python runtime, job isolation and resource/usage budget.

## 2. Retail installers and distribution

- [ ] Audit Electron renderer/backend packaging gap and supported Windows target.
- [ ] Define secure endpoint discovery, provisioning and certificate trust for Retail installations.
- [ ] Package and clean-machine-test Windows installer with artifact checksum/signature plan.
- [ ] Select Android wrapper/build architecture after assessing scanner and local storage APIs.
- [ ] Build, sign and test Android Retail APK on representative small/large phones.
- [ ] Provide HTTPS authenticated/authorized APK download and QR link, not embedded credentials.
- [ ] Design safe version checks, staged rollouts, compatible API windows and update recovery.
- [ ] Keep customer Storefront web-only.

## 3. Offline and real-time architecture

- [ ] Decide single Retail workstation versus local shared hub for multi-device offline use.
- [ ] Define permitted offline operations, local database encryption and login/authorization limits.
- [ ] Design a durable local transaction outbox, stable IDs, replay protection and acknowledgements.
- [ ] Define cloud inventory authority and explicit offline stock allocation/escrow safety.
- [ ] Validate duplicate replay, concurrent cloud demand, partial sync and conflicting writes.
- [ ] Provide connected near-real-time updates, offline status and reconnect reconciliation.
- [ ] Test loss of internet, local hub loss, power interruption, clock drift and repeated reconnect.
- [ ] Prove no silent accepted payment/receipt for a transaction lacking durable confirmation.

## 4. Operational acceptance and release

- [ ] Verify completed migration lineage, backup/restore drill and catalog-image recovery.
- [ ] Resolve canonical 50-source versus runtime 103-product data-parity questions.
- [ ] Test Owner/Staff/Customer auth, ordering, Receiving, POS/MPOS, reports and forecasting.
- [ ] Run real-device camera/HTTPS, desktop installer, Android APK and dark/light QA.
- [ ] Document resource costs, expired Railway trial fallback and incident response.
- [ ] Record exact candidate SHA, audit results, known risks, QA and owner approval.
- [ ] Promote unchanged tested artifacts only when all mandatory release gates are satisfied.

## Sprint Activity Log

- 2026-10-15 — Activated Sprint 13 directly from the merged Sprint 12 `main` SHA.
  Deployment and installer implementation, QA and final approval remain pending.
