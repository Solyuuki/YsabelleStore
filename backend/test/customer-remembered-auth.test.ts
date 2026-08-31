import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";

test("customer remembered quick sign uses dedicated persisted trust rows", () => {
  assert.ok(prisma.customerRememberedAuth);
});
