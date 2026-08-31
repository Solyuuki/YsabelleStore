import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";

test("email Quick Sign uses a dedicated authentication challenge model", () => {
  assert.ok(prisma.customerEmailAuthChallenge);
});
