import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { createCustomerSupportTicket } from "../src/services/customerSupportService.js";
import {
  createSupportGmailClient,
  deliverAutomatedSupportAcknowledgementEmail,
  SUPPORT_AUTOMATION_SENDER_NAME,
  type SupportGmailClient
} from "../src/services/supportGmailService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

function decodeMimePart(rawEmail: string, mimeType: string) {
  const typeIndex = rawEmail.indexOf(`Content-Type: ${mimeType}`);
  assert.notEqual(typeIndex, -1);
  const transferIndex = rawEmail.indexOf("Content-Transfer-Encoding: base64", typeIndex);
  assert.notEqual(transferIndex, -1);
  const bodyStart = rawEmail.indexOf("\r\n\r\n", transferIndex);
  assert.notEqual(bodyStart, -1);
  const payloadStart = bodyStart + 4;
  const payloadEnd = rawEmail.indexOf("\r\n--", payloadStart);
  assert.notEqual(payloadEnd, -1);
  return Buffer.from(
    rawEmail.slice(payloadStart, payloadEnd).replace(/\r\n/g, ""),
    "base64"
  ).toString("utf8");
}

test("automated acknowledgement sends branded multipart email with inline GIF", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const logoBytes = Buffer.from("GIF89a-ysabelle-test-logo", "ascii");
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(
        JSON.stringify({ access_token: "gmail-access-token", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url.includes("/messages/send")) {
      return new Response(
        JSON.stringify({ id: "gmail-ack-1", threadId: "gmail-ack-thread-1" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`Unexpected Gmail test request: ${url}`);
  };

  const client = createSupportGmailClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    supportEmail: "support@ysabelle.invalid",
    fromName: "Ysabelle Store Customer Support",
    fetchImpl,
    logoBytes
  });

  const result = await client.sendSupportReply({
    to: "customer@example.com",
    ticketNumber: "YS-CS-000125",
    subject: "Order concern",
    body: "Hi Customer,\n\nWe’ve received your support request.",
    kind: "ACKNOWLEDGEMENT"
  });

  assert.deepEqual(result, {
    id: "gmail-ack-1",
    threadId: "gmail-ack-thread-1"
  });

  const sendCall = calls.find((call) => call.url.includes("/messages/send"));
  assert.ok(sendCall);
  const sendBody = JSON.parse(String(sendCall.init?.body)) as {
    raw?: string;
    threadId?: string;
  };
  assert.equal(sendBody.threadId, undefined);
  assert.ok(sendBody.raw);

  const rawEmail = Buffer.from(sendBody.raw, "base64url").toString("utf8");
  assert.match(rawEmail, /Auto-Submitted: auto-replied/);
  assert.match(rawEmail, /Content-Type: multipart\/related/);
  assert.match(rawEmail, /Content-Type: image\/gif/);
  assert.match(rawEmail, /Content-ID: <ysabelle-support-logo>/);

  const plainText = decodeMimePart(rawEmail, 'text/plain; charset="UTF-8"');
  const html = decodeMimePart(rawEmail, 'text/html; charset="UTF-8"');
  assert.match(plainText, /We’ve received your support request/);
  assert.match(plainText, /Ticket: YS-CS-000125/);
  assert.match(html, /Support request received/);
  assert.match(html, /cid:ysabelle-support-logo/);
  assert.match(html, /YS-CS-000125/);

  const imageStart = rawEmail.indexOf("Content-ID: <ysabelle-support-logo>");
  const imageBodyStart = rawEmail.indexOf("\r\n\r\n", imageStart);
  const imageBodyEnd = rawEmail.indexOf("\r\n--", imageBodyStart + 4);
  assert.ok(imageStart >= 0 && imageBodyStart >= 0 && imageBodyEnd >= 0);
  const decodedLogo = Buffer.from(
    rawEmail.slice(imageBodyStart + 4, imageBodyEnd).replace(/\r\n/g, ""),
    "base64"
  );
  assert.deepEqual(decodedLogo, logoBytes);
});

test("successful automated acknowledgement records the Gmail thread without changing NEW status", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const ticket = await createCustomerSupportTicket({
      customerName: "Acknowledgement Customer",
      customerEmail: `ack-${randomUUID().slice(0, 8)}@example.com`,
      customerPhone: "09171234567",
      category: "ORDER",
      orderNumber: "",
      subject: "Order acknowledgement",
      message: "Please confirm that my request was received."
    });

    const message = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: "SYSTEM",
        channel: "EMAIL",
        senderName: SUPPORT_AUTOMATION_SENDER_NAME,
        body: "We’ve received your support request.",
        deliveryStatus: "PENDING"
      }
    });

    const client: SupportGmailClient = {
      async getMessage() {
        throw new Error("Not used by acknowledgement delivery test.");
      },
      async listInboxMessages() {
        return [];
      },
      async sendSupportReply(input) {
        assert.equal(input.kind, "ACKNOWLEDGEMENT");
        return {
          id: "gmail-ack-" + randomUUID(),
          threadId: "gmail-ack-thread-" + randomUUID()
        };
      }
    };

    const result = await deliverAutomatedSupportAcknowledgementEmail(message.id, client);
    assert.equal(result.status, "SENT");

    const storedMessage = await prisma.supportMessage.findUniqueOrThrow({
      where: { id: message.id }
    });
    assert.equal(storedMessage.deliveryStatus, "SENT");
    assert.ok(storedMessage.gmailMessageId);
    assert.ok(storedMessage.gmailThreadId);
    assert.ok(storedMessage.emailSentAt);

    const storedTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    });
    assert.equal(storedTicket.status, "NEW");
    assert.equal(storedTicket.gmailThreadId, storedMessage.gmailThreadId);
  } finally {
    await scope.cleanup();
  }
});
