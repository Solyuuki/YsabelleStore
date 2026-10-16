import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relative) =>
  readFileSync(new URL("../../" + relative, import.meta.url), "utf8");

test("Railway uses a first-party API URL and forwards it only to configured backend", () => {
  const docker = source("deployment/railway/frontend.Dockerfile");
  const runtime = source("frontend/src/config/runtime.ts");
  const server = source("deployment/railway/static-server.mjs");
  assert.match(docker, /VITE_RAILWAY_FIRST_PARTY_API=1/);
  assert.match(docker, /API_PROXY_TARGET=\$VITE_API_BASE_URL/);
  assert.match(runtime, /VITE_RAILWAY_FIRST_PARTY_API/);
  assert.match(runtime, /window\.location\.origin/);
  assert.match(server, /new URL\(apiProxyTarget\.origin\)/);
  assert.match(server, /target\.pathname = requested\.pathname/);
  assert.match(server, /x-ysabelle-first-party-proxy/);
  assert.match(server, /request\.pipe\(upstream\)/);
  assert.match(server, /upstreamResponse\.pipe\(response\)/);
  assert.match(server, /"cache-control"\] = "no-store"/);
});

test("OAuth callback securely relays only unconsumed WEB transactions", () => {
  const handler = source("backend/src/controllers/customerSocialAuthController.ts");
  const transactions = source("backend/src/services/customerOAuthTransactionService.ts");
  assert.match(handler, /isPendingCustomerWebOAuthState\(provider, state\)/);
  assert.match(handler, /request\.get\("x-ysabelle-first-party-proxy"\) !== "1"/);
  assert.match(handler, /"Referrer-Policy", "no-referrer"/);
  assert.match(transactions, /transaction\.transport === "WEB"/);
  assert.match(transactions, /transaction\.consumedAt === null/);
  assert.match(transactions, /transaction\.expiresAt\.getTime\(\) > now\.getTime\(\)/);
});

test("Initial unauthenticated customer probe cannot show false session-expired overlay", () => {
  const ui = source("frontend/src/components/shared/GlobalAuthenticationStatusScreen.tsx");
  assert.match(ui, /detail\.path === "\/api\/customer-auth\/me"/);
  assert.match(ui, /!detail\.hadAuthorization/);
});
