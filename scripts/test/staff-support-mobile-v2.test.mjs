import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const page = read("frontend/src/pages/CustomerSupportInboxPage.tsx");
const css = read("frontend/src/styles/retail-support-mobile-v2.css");

test("Support mobile has compact tickets and a conversation-first layout", () => {
  assert.match(page, /ys-support-mobile-inbox-heading/);
  assert.match(page, /ys-support-mobile-status-chips/);
  assert.match(page, /ys-support-ticket-avatar/);
  assert.match(page, /ys-support-mobile-chat-header/);
  assert.match(page, /onBack=\{\(\) => \{/);
  assert.match(page, /setMobileConversationOpen\(true\)/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /\.ys-support-desktop-conversation-header,/);
  assert.match(css, /\.ys-support-desktop-reply-form \{ display: none; \}/);
});
test("Ticket details and status editor are collapsible but operational on mobile", () => {
  assert.match(page, /const \[mobileDetailsOpen, setMobileDetailsOpen\] = useState\(false\)/);
  assert.match(page, /aria-expanded=\{mobileDetailsOpen\}/);
  assert.match(page, /ys-support-mobile-ticket-details/);
  for (const text of ['label="Customer"', 'label="Email"', 'label="Order"', 'label="Last activity"']) {
    assert.ok(page.includes(text), "missing ticket fact: " + text);
  }
  assert.match(page, /statusOptions\.map\(\(status\) =>/);
  assert.match(page, /onStatusSave/);
  assert.match(page, /updateStaffSupportTicketStatus\(detail\.id, nextStatus\)/);
  assert.match(page, /nextStatus === "RESOLVED"/);
  assert.match(page, /STATUS_TRANSITIONS\[detail.status\]/);
  assert.match(page, /mobileConversationOpenRef\.current \|\| result.items.some/);
  assert.match(page, /onReopen=\{\(\) => void saveStatus\("OPEN"\)\}/);
});
test("Closed ticket reopen goes through same status API and outgoing reply uses existing Gmail safeguards", () => {
  assert.match(page, /onReopen=\{\(\) => void saveStatus\("OPEN"\)\}/);
  assert.match(page, /detail.status === "CLOSED" \? \(/);
  assert.match(page, /onSubmit=\{onReplySubmit\}/);
  assert.match(page, /maxLength=\{5000\}/);
  assert.match(page, /disabled=\{replySaving \|\| !reply.trim\(\)\}/);
  assert.match(page, /gmailStatus\?\.configured !== true/);
  assert.match(page, /replyToStaffSupportTicket\(detail\.id, message\)/);
  assert.match(page, /Retry email/);
});
test("Mobile conversation has dedicated scrolling and sticky readable compose controls", () => {
  assert.match(page, /ref=\{mobileThreadRef\}/);
  assert.match(page, /thread.scrollTop = thread.scrollHeight/);
  assert.match(css, /\.ys-support-mobile-composer\s*\{[^}]*safe-area-inset-bottom/);
  assert.match(css, /\.ys-support-mobile-ticket-details\[data-open="true"\]\s*\{/);
  assert.match(css, /:root.dark .retail-workspace \[data-retail-module="customer-support"\] .ys-support-mobile-compose-row textarea/);
  assert.match(css, /@media \(max-width: 359px\)/);
});
