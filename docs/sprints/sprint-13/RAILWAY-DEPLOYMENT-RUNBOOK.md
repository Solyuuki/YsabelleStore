# Sprint 13 — Railway Pre-Deployment Runbook

## Scope

- GitHub source: Solyuuki/YsabelleStore, branch sprint/v0.13/sprint-13.
- Target: isolated Railway pre-deployment project, not automatic production promotion.
- Three services: Railway MySQL, API, and Web (Storefront + authenticated browser Retail).
- API Dockerfile: deployment/railway/backend.Dockerfile.
- Web Dockerfile: deployment/railway/frontend.Dockerfile.
- Electron Windows installers, Android APKs, and offline cloud sync are separate Sprint 13 deliverables.

## Setup sequence

1. Provision isolated Railway MySQL and persistent database storage. Never point cloud services to localhost:3306.
2. Confirm local MySQL export and independent backup before any import. GitHub does not contain local transactional data.
3. Configure the API service with the backend Dockerfile and working repository-root build context. Supply database URL as a private MySQL service variable reference. Set NODE_ENV to production in the environment (pre-deployment is an isolation policy, not a Node runtime mode).
4. Mount a persistent volume at /data/catalog-images for approved local catalog media. CATALOG_IMAGE_STORAGE_ROOT must point to that mount; transfer verified source images separately.
5. After verifying the destination is isolated, take a backup and apply only reviewed Prisma migrations using the checked-in schema. Never db push, force-reset, or run development seed scripts on an imported database.
6. Set the API service to one replica. It starts scheduled restock and Gmail sync workers automatically; protect live mail and customer accounts before starting.
7. Publish the API HTTPS domain. Update external OAuth redirect URIs, payment sandbox callbacks, support sender and recovery URLs for the actual public address.
8. Configure Web using the frontend Dockerfile and mandatory build-time VITE_API_BASE_URL with the API HTTPS origin. Vite embeds the API address in compiled JavaScript.
9. Publish the Web HTTPS domain. Set API FRONTEND_URL and CORS_ORIGINS to the exact Web origin, never localhost or null.
10. Run health endpoints, migration/data parity, product-image verification, forecasting, login, customer recovery, Gmail support, POS, concurrent storefront orders, MPOS, Receiving and PayMongo sandbox testing.
11. Reboot and redeploy both services and verify the database and approved catalog media persist. Record release SHA and backup restoration evidence.

## Deployment safety

- Only approved non-production records may be used for the first Railway testing rollout.
- Local user secrets are never committed to GitHub or embedded into the Web bundle or Android APK.
- Keep explicit Railway usage alerts and an independent backup before trial expiry.
- Railway trial memory may be insufficient for the Python statistics workload; observe metrics under representative load.
- A healthy backend port and static frontend build do not certify operational business functions.
- No automated database migration or canonical fixture insertion runs as a Docker image startup command.
- Do not approve the official release until actual database import, images, OAuth, Gmail, recovery, payments, inventory consistency, and rollback testing pass.

## Mandatory acceptance evidence

- [ ] API and Web deployed successfully from the intended Sprint 13 commit.
- [ ] Verified private MySQL migration history and local data parity.
- [ ] Product images remain available after fresh deployment and restart.
- [ ] Email recovery, two-way Gmail support, OAuth and PayMongo test callback verified.
- [ ] Forecasts run within Railway memory/time limits.
- [ ] Storefront and POS concurrent transactions preserve stock integrity.
- [ ] Backups and restore drill completed.
- [ ] End-to-end QA approved by the project owner.

**Current status:** Build/runtime scaffolding is prepared; Railway services and operational tests require independent activation and confirmation.
