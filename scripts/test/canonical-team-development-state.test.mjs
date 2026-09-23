import assert from "node:assert/strict";
import test from "node:test";

import {
  expectedTeamStockQuantity,
  shouldSyncDevelopmentTeamState,
  teamBatchCode
} from "../canonical-team-development-state.mjs";

test("verified-50 team quantities are deterministic", () => {
  assert.equal(expectedTeamStockQuantity("P008"), 20);
  assert.equal(expectedTeamStockQuantity("P299"), 23);
  assert.equal(expectedTeamStockQuantity("P397"), 13);
});

test("team batch identity is stable across developer machines", () => {
  assert.equal(teamBatchCode("SARIMA-P022"), "QA50-SARIMA-P022-20260923");
});

test("team development sync is local-only and never production", () => {
  assert.equal(
    shouldSyncDevelopmentTeamState({
      DATABASE_URL: "mysql://dev:dev@127.0.0.1:3306/ysabelle_store",
      NODE_ENV: "development"
    }),
    true
  );
  assert.equal(
    shouldSyncDevelopmentTeamState({
      DATABASE_URL: "mysql://dev:dev@db.example.com:3306/ysabelle_store",
      NODE_ENV: "development"
    }),
    false
  );
  assert.equal(
    shouldSyncDevelopmentTeamState({
      DATABASE_URL: "mysql://dev:dev@127.0.0.1:3306/ysabelle_store",
      NODE_ENV: "production"
    }),
    false
  );
});
