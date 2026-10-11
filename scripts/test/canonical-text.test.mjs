import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalTextBytes,
  gitBlobOidCanonicalText,
  normalizeCanonicalText,
  sha256CanonicalText
} from "../lib/canonical-text.mjs";

test("canonical text identity ignores CRLF checkout conversion", () => {
  const lf = "line one\nline two\n";
  const crlf = "line one\r\nline two\r\n";
  assert.equal(normalizeCanonicalText(crlf), lf);
  assert.deepEqual(canonicalTextBytes(crlf), canonicalTextBytes(lf));
  assert.equal(sha256CanonicalText(crlf), sha256CanonicalText(lf));
  assert.equal(gitBlobOidCanonicalText(crlf), gitBlobOidCanonicalText(lf));
});

test("canonical text identity still detects substantive edits", () => {
  assert.notEqual(sha256CanonicalText("alpha\n"), sha256CanonicalText("beta\n"));
  assert.notEqual(gitBlobOidCanonicalText("alpha\n"), gitBlobOidCanonicalText("beta\n"));
});
