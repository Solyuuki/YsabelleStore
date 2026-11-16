# Sprint 13 Goal

## Goal

Deliver a deployment-tested, operationally safe YsabelleStore release candidate
for thesis defense: Railway-hosted Storefront and Retail web, verified Windows
and Android Retail distribution, and independently validated offline Retail
transactions with safe cloud synchronization.

## Success criteria

- A reproducible Railway deployment serves the Storefront, protected Retail web,
  shared backend, persistent MySQL and required Python forecasting runtime.
- Production-like health, network, login, customer ordering and POS/MPOS
  transactions pass against an isolated test environment.
- Concurrent Storefront/POS ordering cannot silently oversell stock.
- Installer artifacts are built, identified, verified and tested on real devices.
- Retail sessions, updates and API compatibility remain secure across versions.
- A disconnected Retail terminal continues only explicitly supported workflows;
  pending operations persist across restart and reconcile safely on reconnect.
- Forecasting, Receiving, catalog images, customer flows and dark/light/mobile
  usability are verified on the target topology.
- Recovery, secrets, backups, restore drills, monitoring and rollback have evidence.
- Exact-head CI, manual end-to-end QA and acceptance records are complete.

## Non-goals and boundaries

- No replacement of the existing authoritative checkout/inventory rules.
- No customer Storefront APK; its desktop/mobile browser behavior stays on the web.
- No assumption that Electron packaging alone enables offline checkout.
- No claim of guaranteed zero bugs or a permanent hosting service on a trial.
- No live deployment or database mutation implied by sprint activation.
