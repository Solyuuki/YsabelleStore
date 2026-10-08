import assert from "node:assert/strict";
import test from "node:test";

import { extractLatestCustomerEmailReply, parseSupportResolutionEmailReply } from "../src/services/supportGmailService.js";

test("resolution replies require an explicit standalone YES or NO", () => {
  assert.equal(parseSupportResolutionEmailReply("YES"), "YES");
  assert.equal(parseSupportResolutionEmailReply("yes\n\nOn Thursday, Support wrote:"), "YES");
  assert.equal(parseSupportResolutionEmailReply("NO"), "NO");
  assert.equal(parseSupportResolutionEmailReply("no.\r\nQuoted email"), "NO");
  assert.equal(parseSupportResolutionEmailReply("Yes please help me"), null);
  assert.equal(parseSupportResolutionEmailReply("I guess yes"), null);
  assert.equal(parseSupportResolutionEmailReply("Not yet"), null);
  assert.equal(parseSupportResolutionEmailReply(""), null);
});


test("quoted Gmail history is excluded from customer reply text", () => {
  const reply = [
    "Yes",
    "",
    "On Thu, Oct 8, 2026 at 11:27 AM Ysabelle Store Customer Support <",
    "ysabellestore.support@gmail.com> wrote:",
    "",
    "> Ysabelle Store",
    "> Please confirm your resolution",
    "> Hello ALTHEA PERONA,"
  ].join("\n");

  assert.equal(extractLatestCustomerEmailReply(reply), "Yes");
  assert.equal(parseSupportResolutionEmailReply(extractLatestCustomerEmailReply(reply)), "YES");
});

test("other email formats are cleaned without truncating genuine customer text", () => {
  assert.equal(
    extractLatestCustomerEmailReply(
      "I still need assistance.\r\n\r\n-----Original Message-----\r\nFrom: support@example.com"
    ),
    "I still need assistance."
  );
  assert.equal(
    extractLatestCustomerEmailReply("Thank you.\n\n> Old quoted message\n> More quote"),
    "Thank you."
  );
  assert.equal(
    extractLatestCustomerEmailReply(
      "Can you send a replacement?\n\nFrom: support@example.com\nSent: Today\nSubject: My order"
    ),
    "Can you send a replacement?"
  );
  assert.equal(
    extractLatestCustomerEmailReply("I still need help with the delivery.\nPlease call me tomorrow."),
    "I still need help with the delivery.\nPlease call me tomorrow."
  );
});
