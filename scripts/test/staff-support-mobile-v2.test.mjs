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


test("Support conversation occupies the actual app workspace rather than using a hardcoded viewport subtraction", () => {
  const responsive = css.slice(css.indexOf("@media (max-width: 1024px)"));
  assert.match(responsive, /\.retail-workspace > main\[data-retail-module="customer-support"\]\s*\{\s*display: flex;\s*flex-direction: column;\s*min-height: 0;/);
  assert.match(responsive, /\.retail-workspace > main\[data-retail-module="customer-support"\] > div\s*\{\s*display: flex;\s*flex: 1 1 auto;\s*flex-direction: column;\s*min-height: 0;/);
  assert.match(responsive, /\.ys-support-page\s*\{[^}]*flex: 1 1 auto;/);
  assert.match(responsive, /\.ys-support-inbox\s*\{[^}]*flex: 1 1 auto;\s*height: auto;\s*min-height: 0;/);
  assert.doesNotMatch(responsive, /height:\s*max\(350px,\s*calc\(100dvh - 160px\)\)/);
  assert.match(responsive, /\.ys-support-inbox__conversation\s*\{[^}]*flex: 1 1 auto;/);
  assert.match(responsive, /\.ys-support-thread\s*\{[^}]*grid-row: 3;[^}]*min-height: 0;[^}]*overflow-y: auto;/);
  assert.match(responsive, /\.ys-support-mobile-composer\s*\{[^}]*flex: none;/);

  const appLayout = read("frontend/src/layouts/AppLayout.tsx");
  assert.match(appLayout, /flex h-dvh min-h-0 overflow-hidden/);
  assert.match(appLayout, /retail-workspace relative z-10 flex min-h-0 min-w-0 flex-1 flex-col/);
  assert.match(appLayout, /min-h-0 flex-1 overflow-auto/);
});

test("Long mobile Support conversations constrain messages to the middle grid row", () => {
  assert.match(css, /\.ys-support-conversation-layout\s*\{[^}]*display: grid;[^}]*grid-template-rows: auto auto minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.ys-support-mobile-chat-header\s*\{[^}]*grid-row: 1;/);
  assert.match(css, /\.ys-support-mobile-ticket-details\[data-open="true"\]\s*\{[^}]*grid-row: 2;/);
  assert.match(css, /\.ys-support-thread\s*\{[^}]*grid-row: 3;[^}]*min-height: 0;[^}]*overflow-y: auto;[^}]*touch-action: pan-y;/);
  assert.match(css, /\.ys-support-mobile-composer\s*\{[^}]*grid-row: 4;/);
  assert.match(page, /aria-label="Conversation messages"/);
  assert.match(page, /role="region"/);
  assert.match(page, /tabIndex=\{0\}/);
});

test("Mobile wheel over any chat bubble scrolls the message viewport, not the outer page", () => {
  assert.match(page, /ref=\{mobileConversationRef\}/);
  assert.match(page, /const thread = mobileThreadRef\.current;/);
  assert.match(page, /const wheelMessages = \(event: WheelEvent\) =>/);
  assert.match(page, /thread\.getBoundingClientRect\(\)/);
  assert.match(page, /event\.clientX < bounds\.left/);
  assert.match(page, /event\.clientY > bounds\.bottom/);
  assert.match(page, /thread\.scrollHeight - thread\.clientHeight/);
  assert.match(page, /event\.deltaMode === 1 \? 16/);
  assert.match(page, /event\.deltaMode === 2 \? thread\.clientHeight : 1/);
  assert.match(page, /event\.preventDefault\(\);\s*thread\.scrollTop = Math\.max\(0, Math\.min\(maxScroll, thread\.scrollTop \+ scrollAmount\)\);/);
  assert.match(page, /addEventListener\("wheel", wheelMessages, \{ capture: true, passive: false \}\)/);
  assert.match(page, /removeEventListener\("wheel", wheelMessages, true\)/);
  assert.match(page, /event\.ctrlKey/);
  assert.match(page, /window\.matchMedia\("\(max-width: 1024px\)"\)\.matches/);
});

test("Fixed header and reply controls are excluded from wheel forwarding", () => {
  assert.match(css, /grid-template-rows: auto auto minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.ys-support-thread\s*\{[^}]*overflow-y: auto;/);
  assert.match(css, /\.ys-support-mobile-composer\s*\{[^}]*grid-row: 4;/);
  assert.match(page, /event\.clientY < bounds\.top/);
  assert.match(page, /event\.clientY > bounds\.bottom/);
});
