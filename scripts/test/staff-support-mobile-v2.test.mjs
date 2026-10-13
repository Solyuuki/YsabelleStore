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

test("Switching tickets never briefly renders another ticket's messages or status actions", () => {
  assert.match(page, /detail && detail.id !== selectedTicketId/);
  assert.match(page, /detail && detail.id === selectedTicketId/);
});


test("status pills keep full labels and expose two-way horizontal navigation at narrow widths", () => {
  assert.match(page, /ys-support-mobile-status-toolbar/);
  assert.match(page, /ref=\{statusChipsRef\}/);
  assert.match(page, /scrollStatusChips\(-1\)/);
  assert.match(page, /scrollStatusChips\(1\)/);
  assert.match(page, /data-scrollable=\{statusChipsScroll.hasOverflow\}/);
  assert.match(css, /\.ys-support-mobile-status-toolbar\s*\{[^}]*flex-direction: column;/);
  assert.match(css, /\.ys-support-status-scroll-buttons\[data-scrollable="false"\]\s*\{\s*display: none;/);
  assert.match(css, /\.ys-support-mobile-status-toolbar, \.ys-support-mobile-status-chips/);
  assert.match(page, /aria-label="Previous status choices"/);
  assert.match(page, /aria-label="Next status choices"/);
  assert.match(page, /setStatusFilter\(filter\)/);
  assert.match(page, /resetToFirstPage\(\)/);
  assert.match(css, /min-width: max-content;/);
  assert.match(css, /white-space: nowrap;/);
  assert.match(css, /scroll-snap-type: x proximity;/);
  assert.match(css, /touch-action: pan-x;/);
});

test("support More filters stacks complete select values based on actual panel width", () => {
  assert.match(css, /container: support-filters \/ inline-size;/);
  assert.match(css, /@container support-filters \(max-width: 430px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(page, /className="ys-support-filter-field grid/);
  assert.match(page, /className="ys-support-filter-select ys-retail-select-chevron/);
  assert.match(page, /aria-label=\{label\}/);
  assert.match(css, /\.ys-support-filter-select\s*\{/);
  assert.match(css, /min-height: 44px;/);
  assert.match(css, /:root.dark .retail-workspace \[data-retail-module="customer-support"\] .ys-support-filter-select option/);
});
