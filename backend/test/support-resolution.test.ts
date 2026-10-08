import assert from "node:assert/strict";
import test from "node:test";

import { parseSupportResolutionEmailReply } from "../src/services/supportGmailService.js";

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
