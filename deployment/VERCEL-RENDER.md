# Deployment branch: Vercel frontend + Render backend

This is an **independent cloud-deployment target** for `Solyuuki/YsabelleStore`. It changes only the `Deployment` branch; the desktop/Electron and Sprint 13 branches are unaffected.

## Architecture

```text
Browser
  | https://<vercel-site>.vercel.app
  v
Vercel (React + Vite static frontend)
  | /api/* HTTPS reverse proxy (vercel.mjs)
  v
Render (Docker, Node.js 22 + Express + Prisma + Python forecasting)
  | DATABASE_URL
  v
External persistent MySQL 8 database
```

**Status:** Render Free backend service and Vercel project resources have been created; live working deployment and feature parity still require the Vercel GitHub integration, a compatible persistent database, storage and end-to-end tests. No hosting or database credentials are committed.

## 1. Database prerequisites (before enabling transactional features)

- Select a durable MySQL-compatible host and verify Prisma MySQL compatibility. Render Free **does not provide persistent MySQL**.
- Inventory/POS/orders/authentication need a persistent database. Recover a verified backup of the previous Railway MySQL database if retaining existing business data is required. A GitHub repository does **not** contain the live runtime database.
- Keep `DATABASE_URL` in Render secrets only. Use a database-specific user with the least necessary privileges.
- Back up and inspect migration state before any production schema operation. This project uses **Prisma Generation 2 migrations** under `database/prisma/migrations/`. In a new, confirmed-empty database, controlled `prisma migrate deploy --schema database/prisma/schema.prisma` can apply the versioned schema. For a pre-existing database, first follow `database/prisma/MIGRATION_GENERATION_2.md` and the canonical-state recovery runbooks; **do not** run `db push` or unreviewed resets.
- Existing imported/catalog image bytes are separate from MySQL rows; preserving image records does not automatically preserve the uploaded image files.

## 2. Render backend (create before Vercel)

1. Connect the GitHub repo `Solyuuki/YsabelleStore` to Render.
2. Create a Blueprint using **branch `Deployment`**, root `render.yaml` (one free web service, Docker context repository root). The backend uses `deployment/render/backend.Dockerfile`.
3. Set values requested by the Blueprint (**do not paste secrets into code**):
   - `DATABASE_URL`: verified durable MySQL connection string.
   - `FRONTEND_URL`: the **exact production Vercel origin**, e.g. `https://<project>.vercel.app` (no path/trailing slash). Use a temporary planned origin during initial setup, then update before testing authentication.
   - `CORS_ORIGINS`: comma-separated allowlist containing that same Vercel origin. Do not use `*` for credentialed requests.
   - `CUSTOMER_OAUTH_PUBLIC_BACKEND_URL`: `https://<service>.onrender.com` (required for callback URL generation).
   - `JWT_SECRET` and `CUSTOMER_OAUTH_TRANSACTION_KEY` are created by the Blueprint and must remain secret.
4. Optional features require their original provider configuration in Render (Resend or Gmail email delivery, Google/Meta OAuth, PayMongo, AI provider credentials). Without those values, their features cannot be claimed operational.
5. Deploy and record the Render origin. Use `GET https://<service>.onrender.com/api/health/live` to confirm the Node process started. Use `/api/health/ready` to verify MySQL and JWT readiness (**must return 200** before functional testing).

**No automatic schema reset, seed, or data import runs on Render startup.**

## 3. Vercel frontend

1. Connect the same repo to Vercel; select **production branch `Deployment`** and **Root Directory `.`** (repo root, not `frontend/`).
2. Vercel reads `vercel.json`, which declares `npm ci --ignore-scripts`, `VITE_FIRST_PARTY_API=1 npm run build --workspace=@ysabellestore/frontend`, output `frontend/dist`, and HTTPS first-party API rewrites.\n3. The committed Render destination is `https://ysabellestore-api.onrender.com`, confirmed from the Free service created for this branch. If the Render hostname changes, update the rewrite destinations in `vercel.json` and re-run deployment tests.
4. Vercel routes browser `/api/*` calls to Render using a **same-origin rewrite**, preserving the frontend's existing cookie-based auth model. SPA fallback to `index.html` supports deep links.
5. Confirm Vercel's final production URL and set the exact URL as Render's `FRONTEND_URL` and `CORS_ORIGINS`. Recheck `/api/health/ready` via the **Vercel site**, not only directly on Render.

Vercel's Hobby plan is for personal/non-commercial projects, and Render Free sleeps after inactivity. Suitability for real retail operations requires reviewing plan policies and performance.

## 4. OAuth and authentication

- Register `https://<service>.onrender.com/api/customer-auth/social/google/callback` as the Google OAuth redirect URI (and equivalent provider routes if enabled).
- Browser OAuth begins through the Vercel origin. The provider callback visits Render, then redirects once to the Vercel first-party `/api` route. The short `_ysabelle_first_party=1` relay marker prevents a callback loop; it is **not** authentication proof.
- Test that login, logout, registration, remembered account and OAuth flows set/use first-party cookies correctly; verify callback state and session restrictions.
- Avoid treating preview Vercel URLs as trusted production origins unless they are specifically and intentionally allowlisted.

## 5. Storage and free-tier limitations

**Render Free's filesystem is ephemeral.** This Dockerfile intentionally uses `/tmp/ysabelle-catalog-images` for the current image engine so the process can run, but **new uploads and generated images can disappear on restart, redeploy or sleep**. Do not use this arrangement for real store image storage or describe catalog uploads as persistent. A durable object-store adapter or a paid persistent disk plus the corresponding migration is a separate requirement.

The Python forecasting and image-processing dependencies are installed in the Render Docker image. Long-running SARIMA work may be slow or exceed free-memory limits; performance and forecast correctness require a real deployment test. Render Free cold starts will add latency.

## 6. Deployment acceptance (must all be checked)

- [ ] Render container deploys; `/api/health/live` returns 200.
- [ ] External MySQL is migrated or restored, and `/api/health/ready` returns 200.
- [ ] Vercel build succeeds; deep-link refresh works (e.g. `/login`, `/shop`).
- [ ] `https://<vercel-host>/api/health/ready` reaches Render and returns valid JSON.
- [ ] Login, logout, customer registration and OAuth callbacks work with browser cookies.
- [ ] Products, stock changes, POS, sales, checkout, delivery and history persist across requests.
- [ ] Forecasting runs and shows valid results under the selected Render plan.
- [ ] Catalog image assets and image uploads are moved to **durable storage** and survive restart.
- [ ] Email, PayMongo and other configured integrations are tested in their intended environments.
- [ ] Logs show no secrets, SQL destructive actions, or unexpected CORS/origin failures.

## 7. Local validation

```bash
node --test scripts/test/deployment-hosting.test.mjs
npm ci
npm run prisma:generate
npm run build --workspace=@ysabellestore/backend
VITE_FIRST_PARTY_API=1 npm run build --workspace=@ysabellestore/frontend
```

Changes are committed directly to `Deployment`; **no PR/merge is part of this workflow**.

## Troubleshooting

- **Vercel build fails mentioning RENDER_API_ORIGIN:** set the backend origin in Vercel environment variables, then redeploy.
- **API 502 / backend cold start:** check the Render instance state/logs and request `/api/health/live` directly.
- **Backend live but readiness 503:** check `DATABASE_URL`, MySQL connectivity/schema and JWT.
- **Browser auth fails:** confirm the Vercel site uses first-party `/api` calls, Render's exact `FRONTEND_URL`, and credentialed CORS allowlist.
- **OAuth loop or login callback fails:** check provider's registered Render callback URI, Render `CUSTOMER_OAUTH_PUBLIC_BACKEND_URL`, and the first-party relay.
- **Missing images after restart:** expected with ephemeral Free storage; deploy durable storage before production use.
