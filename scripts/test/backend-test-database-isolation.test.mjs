import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDisposableTestDatabaseUrl,
  databaseNameFromUrl,
  isDisposableTestDatabaseUrl
} from "../lib/test-database-isolation.mjs";

test("backend tests derive a disposable MySQL database instead of reusing development data", () => {
  const developmentUrl = "mysql://dev:secret@127.0.0.1:3306/ysabellestore?connection_limit=5";
  const disposableUrl = buildDisposableTestDatabaseUrl(developmentUrl, "abc123");

  assert.equal(databaseNameFromUrl(developmentUrl), "ysabellestore");
  assert.equal(databaseNameFromUrl(disposableUrl), "ysabellestore_test_abc123");
  assert.equal(isDisposableTestDatabaseUrl(developmentUrl), false);
  assert.equal(isDisposableTestDatabaseUrl(disposableUrl), true);
  assert.match(disposableUrl, /^mysql:\/\/dev:secret@127\.0\.0\.1:3306\//);
  assert.match(disposableUrl, /connection_limit=5$/);
});

test("known CI and test database names are already disposable", () => {
  assert.equal(isDisposableTestDatabaseUrl("mysql://ci:ci@127.0.0.1:3306/ysabellestore_ci"), true);
  assert.equal(isDisposableTestDatabaseUrl("mysql://dev:dev@127.0.0.1:3306/ysabellestore_test"), true);
  assert.equal(isDisposableTestDatabaseUrl("mysql://dev:dev@127.0.0.1:3306/test_ysabellestore"), true);
});

test("test database isolation rejects non-MySQL database URLs", () => {
  assert.throws(
    () => buildDisposableTestDatabaseUrl("postgresql://dev:dev@localhost/ysabellestore", "abc123"),
    /MySQL/
  );
});
