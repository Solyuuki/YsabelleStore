import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import { createCustomerSupportTicket } from "../src/services/customerSupportService.js";
import {
  createResolutionToken,
  hasCustomerResolutionConfirmation,
  inspectResolutionToken,
  submitResolutionResponse
} from "../src/services/supportResolutionService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

async function prepareTicket() {
  const ticket = await createCustomerSupportTicket({
    customerName: "Resolution Test Customer",
    customerEmail: `support-resolution-${randomUUID().slice(0, 8)}@example.com`,
    category: "OTHER",
    subject: "Support resolution confirmation",
    message: "Please assist me with a customer support question."
  });
  const requestId = randomUUID();
  await prisma.supportMessage.create({
    data: {
      id: requestId,
      ticketId: ticket.id,
      senderType: "STAFF",
      channel: "EMAIL",
      senderName: "Support Test",
      body: "YS_SUPPORT_RESOLUTION_REQUEST:\nPlease confirm resolution.",
      deliveryStatus: "SENT"
    }
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "WAITING_FOR_CUSTOMER" }
  });
  return { ticket, requestId };
}

test("resolution links require a valid unexpired signature and are single use", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const originalSecret = env.JWT_SECRET;
  try {
    env.JWT_SECRET = "ysabelle-support-resolution-qa-secret-32-chars";
    const { ticket, requestId } = await prepareTicket();
    const token = createResolutionToken(ticket.id, requestId);

    assert.ok(await inspectResolutionToken(token));
    assert.equal(await inspectResolutionToken(`${token}tampered`), null);
    assert.equal(await inspectResolutionToken(
      createResolutionToken(ticket.id, requestId, Date.now() - 73 * 60 * 60 * 1000)
    ), null);

    const result = await submitResolutionResponse(token, "YES");
    assert.equal(result.answer, "YES");
    assert.equal((await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    })).status, "OPEN");
    assert.equal(await hasCustomerResolutionConfirmation(ticket.id), true);
    assert.equal(await inspectResolutionToken(token), null);
    await assert.rejects(
      () => submitResolutionResponse(token, "YES"),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 410
    );
  } finally {
    env.JWT_SECRET = originalSecret;
    await scope.cleanup();
  }
});

test("No, I need more help reopens the ticket without authorizing Resolved", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const originalSecret = env.JWT_SECRET;
  try {
    env.JWT_SECRET = "ysabelle-support-resolution-qa-secret-32-chars";
    const { ticket, requestId } = await prepareTicket();
    const result = await submitResolutionResponse(createResolutionToken(ticket.id, requestId), "NO");
    assert.equal(result.answer, "NO");
    assert.equal((await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    })).status, "OPEN");
    assert.equal(await hasCustomerResolutionConfirmation(ticket.id), false);
  } finally {
    env.JWT_SECRET = originalSecret;
    await scope.cleanup();
  }
});
