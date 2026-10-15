# Sprint 13 — Target Deployment Architecture

## Existing verified foundations

- The Sprint 12 web Storefront and Retail UI use a shared React/Vite bundle
  and backend API based on Node.js/Express.
- Backend uses Prisma/MySQL and starts local workers for restock and support.
- Forecasting requires a compatible Python environment.
- Electron currently packages a renderer, not a complete offline transaction stack.
- The existing mobile preview is a LAN development tool, not a shipped Android APK.
- Current production cloud hosting, offline outbox and signed auto-updates
  are not established by the committed implementation.

## Railway pre-deployment topology

1. A hosted web service serves customer Storefront and authorized Retail browser UI.
2. A private backend service hosts business APIs, authentication, forecasting execution,
   scheduled jobs and operational readiness endpoints.
3. A hosted MySQL instance is the authoritative online transaction database.
4. Product-image and other durable file assets use an explicitly persistent storage target.
5. HTTPS public ingress, restricted origins, correctly configured OAuth/payment webhooks,
   rate limits, secrets and service-to-service access are required.
6. The environment is isolated from local developer and actual business data during QA.

The actual service allocation, costs, Railway resource limits and provider-specific
configuration must be confirmed against the target account before implementation.
Do not assume the free trial guarantees uninterrupted hosting for a calendar month.

## Retail distribution

- **Windows:** Electron Retail renderer with approved production API endpoints,
  signed NSIS installer, version controls and clean-machine validation.
- **Android:** An Android-specific wrapper/runtime must be selected, implemented and
  signed. A QR code opens an authenticated, HTTPS APK download page; scanning a
  code cannot silently install an APK.
- **Storefront:** Remains a responsive website, not a desktop or Android package.
- **Updates:** Signed staged updates, supported API version windows, safe restarts
  and recovery/rollback controls; no forced update during checkout.

## Offline transaction architecture (future implementation)

An installer alone cannot execute offline POS transactions. The target design
adds a durable local transaction authority, local encrypted data, and a retryable
outbox. A dedicated store-local hub is preferred if multiple terminals must
share stock while internet connectivity is down.

At reconnect, the hub/sync engine must provide:

- Persistent event IDs, stable idempotency keys and server acknowledgements.
- Explicit business-state transitions for accepted, pending and rejected events.
- Pre-allocated offline selling limits or another formally approved approach
  that prevents cloud sales and disconnected tills overselling shared stock.
- Conflict detection, audit logs and operator-visible reconciliation queues.
- Near-real-time push/subscription updates when connected and eventual
  consistency after a network outage.

Do not enable offline writes or local/cloud bidirectional database replication
without transactional stock-safety, concurrency and recovery evidence.
Connected Retail web must continue to use the canonical backend APIs.

## Promotion and isolation

Build and validate on Sprint 13 integration branch. Promote to `main` only
after reviewed CI. Deploy from an immutable approved release reference to a
separate pre-deployment environment. Production promotion is a distinct,
explicit action with its own data backups, smoke checks and rollback record.

Thesis-defense acceptance does not by itself prove safe live release. Post-deployment
verification may approve the same unchanged tested artifact if all mandatory
criteria pass and no blocking operational risk remains.
