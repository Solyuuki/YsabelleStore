# Sprint 13 — Pre-Deployment and Retail Distribution

Sprint 13 builds on the exact merged Sprint 12 `main` commit
`be5accbaf088aff3e9f5d1bb146561752335396b`. This is a pre-deployment engineering and acceptance sprint,
not evidence of a published production release.

## Release identity

- Integration branch: `sprint/v0.13/sprint-13`
- Starting source: `main` at `be5accbaf088aff3e9f5d1bb146561752335396b`
- Active sprint: 13
- Development display version: `v0.13.0`
- Canonical database, catalog, and image versions remain independently controlled.
- Private npm workspace versions remain unchanged unless an explicit packaging decision requires updates.

## Goal

Prepare YsabelleStore for a fully operational, secure and recoverable hybrid release:

- Deploy the customer Storefront and authorized browser-based Retail UI on Railway,
  backed by the same authenticated API and authoritative MySQL data.
- Verify the Windows Electron Retail installer and its production API configuration.
- Plan and deliver a signed Android Retail APK and secure QR-directed download flow,
  without turning the customer Storefront into an APK.
- Design, implement, and verify an offline-capable Retail transaction path, durable
  local data and safe eventual cloud synchronization.
- Introduce controlled application updates with compatible API contracts.
- Protect production data, product assets, user sessions, and inventory integrity.

## Implementation order

1. Railway isolated pre-deployment environment, secrets and runtime readiness.
2. Hosted Storefront and authorized Retail web end-to-end testing.
3. Desktop Retail packaging and Android Retail distribution.
4. Local/offline transactions and reconnect synchronization with inventory safeguards.
5. Production-like release rehearsal, security review, backup/restore, QA and defense.
6. Post-deployment acceptance and official release only after evidence-based approval.

## Guardrails

- Only the Sprint 13 branch is changed by this activation; `main` stays untouched.
- Railway trial or GitHub CI success does not establish production readiness.
- No real credentials, seeded development accounts, or production backups in Git.
- Never reset live MySQL data or force canonical replacement as an upgrade shortcut.
- Separate isolated test deployments from real business operations.
- Any offline cash/POS flow is **not released** until durability, duplicate replay,
  reconciliation and overselling protection are demonstrated.
- A signed installer or working mobile preview alone does not prove offline support.

## Status

Sprint 13 branch activated and planning documents initialized. Railway deployment,
installer validation, Android APK, auto-update and offline synchronization remain
pending implementation and acceptance. See the sprint goal, backlog, risks,
architecture and Definition of Done.
