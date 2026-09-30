import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  routes,
  routeIndex,
  appRoutes,
  appShell,
  sidebar,
  internalAuth,
  inboxPage,
  gmailService,
  staffService
] = await Promise.all([
    readFile(new URL("../../backend/src/routes/staffSupport.routes.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/src/routes/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/src/app/routes.ts", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/src/app/AppShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/src/components/app/AppSidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/src/utils/internalAuthRoutes.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../frontend/src/pages/CustomerSupportInboxPage.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../../backend/src/services/supportGmailService.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/src/services/staffSupportService.ts", import.meta.url), "utf8")
  ]);

test("staff support API is bearer protected for both OWNER and STAFF", () => {
  assert.match(routeIndex, /router\.use\("\/support", staffSupportRouter\)/);
  assert.match(routes, /requireAuth, requireRole\("OWNER", "STAFF"\)/);
  assert.match(routes, /get\("\/tickets"/);
  assert.match(routes, /post\("\/tickets\/:ticketId\/replies"/);
  assert.match(routes, /patch\(\s*"\/tickets\/:ticketId\/status"/);
  assert.match(routes, /get\("\/gmail\/status"/);
  assert.match(routes, /post\("\/gmail\/sync"/);
  assert.match(routes, /retry-email/);
});

test("staff application exposes a split customer support workspace", () => {
  assert.match(appRoutes, /path: "\/customer-support"/);
  assert.match(appShell, /CustomerSupportInboxPage/);
  assert.match(sidebar, /"\/customer-support"/);
  assert.match(inboxPage, /grid min-h-\[680px\]/);
  assert.match(inboxPage, /Staff reply/);
  assert.match(inboxPage, /Ticket status/);
});

test("customer support API never receives the internal bearer token", () => {
  assert.match(internalAuth, /"\/api\/customer-support"/);
  assert.match(internalAuth, /"\/customer-support"/);
});

test("Phase 4 Gmail integration preserves ticket threading and delivery state", () => {
  assert.match(gmailService, /oauth2\.googleapis\.com\/token/);
  assert.match(gmailService, /gmail\.googleapis\.com\/gmail\/v1\/users\/me/);
  assert.match(gmailService, /gmailMessageId/);
  assert.match(gmailService, /gmailThreadId/);
  assert.match(gmailService, /deliveryStatus: "SENT"/);
  assert.match(gmailService, /deliveryStatus: "FAILED"/);
  assert.match(gmailService, /senderType: "CUSTOMER"/);
  assert.match(gmailService, /channel: "EMAIL"/);
  assert.match(inboxPage, /Sync Gmail/);
  assert.match(inboxPage, /Retry email/);
});


test("Phase 5 hardening keeps failed delivery actionable and prevents silent local replies", () => {
  assert.match(gmailService, /GMAIL_SYNC_MAX_MESSAGES/);
  assert.match(gmailService, /cachedAccessToken/);
  assert.match(gmailService, /runtimeGmailClient/);
  assert.match(gmailService, /response\.status === 401/);
  assert.match(gmailService, /SUPPORT_EMAIL_BODY_MAX_LENGTH/);
  assert.match(gmailService, /status: "OPEN"/);
  assert.match(gmailService, /status: "WAITING_FOR_CUSTOMER"/);
  assert.match(staffService, /isSupportLocalReplyFallbackAllowed/);
  assert.match(staffService, /SUPPORT_GMAIL_NOT_CONFIGURED/);
  assert.match(staffService, /SUPPORT_EMAIL_DELIVERY_PENDING/);
  assert.match(staffService, /deliveryStatus: "FAILED"/);
  assert.match(inboxPage, /Gmail must be connected before a customer reply can be sent/);
  assert.match(inboxPage, /Failed delivery keeps/);
});
