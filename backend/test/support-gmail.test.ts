import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { createCustomerSupportTicket } from "../src/services/customerSupportService.js";
import {
  createSupportGmailClient,
  syncSupportGmailInboxWithClient,
  type GmailApiMessage,
  type SupportGmailClient
} from "../src/services/supportGmailService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

test("Gmail client exchanges the refresh token and sends the canonical ticket subject", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "gmail-access-token" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.includes("/messages/send")) {
      return new Response(JSON.stringify({ id: "gmail-message-1", threadId: "gmail-thread-1" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    throw new Error(`Unexpected Gmail test request: ${url}`);
  };

  const client = createSupportGmailClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    supportEmail: "novelaarchives@gmail.com",
    fromName: "Ysabelle Store Customer Support",
    fetchImpl
  });

  const result = await client.sendSupportReply({
    to: "customer@example.com",
    ticketNumber: "YS-CS-000124",
    subject: "Payment Concern",
    body: "We are reviewing your payment concern."
  });

  assert.deepEqual(result, {
    id: "gmail-message-1",
    threadId: "gmail-thread-1"
  });

  const tokenCall = calls.find((call) => call.url === "https://oauth2.googleapis.com/token");
  assert.ok(tokenCall);
  assert.match(String(tokenCall.init?.body), /grant_type=refresh_token/);

  const sendCall = calls.find((call) => call.url.includes("/messages/send"));
  assert.ok(sendCall);
  const sendBody = JSON.parse(String(sendCall.init?.body)) as { raw?: string };
  assert.ok(sendBody.raw);
  const rawEmail = Buffer.from(sendBody.raw, "base64url").toString("utf8");
  assert.match(rawEmail, /To: customer@example\.com/);
  assert.match(rawEmail, /Subject: =\?UTF-8\?B\?/);
  assert.match(
    Buffer.from(
      rawEmail.match(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]+?)\r\n$/)?.[1]?.replace(/\r\n/g, "") ?? "",
      "base64"
    ).toString("utf8"),
    /YS-CS-000124/
  );
});

test("Gmail inbox sync imports only the matching customer reply and is idempotent", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const ticket = await createCustomerSupportTicket({
      customerName: "Gmail Sync Customer",
      customerEmail: "gmail-sync-customer@example.com",
      customerPhone: "09171234567",
      category: "PAYMENT",
      orderNumber: "",
      subject: "Payment Concern",
      message: "I need help with my payment."
    });

    const gmailMessage: GmailApiMessage = {
      id: "gmail-inbound-" + randomUUID(),
      threadId: "gmail-thread-" + randomUUID(),
      internalDate: String(Date.now()),
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          {
            name: "From",
            value: "Gmail Sync Customer <gmail-sync-customer@example.com>"
          },
          {
            name: "Subject",
            value: `Re: [${ticket.ticketNumber}] Payment Concern`
          }
        ],
        parts: [
          {
            mimeType: "text/plain",
            body: {
              data: Buffer.from("Here is my follow-up from Gmail.", "utf8").toString("base64url")
            }
          }
        ]
      }
    };

    const client: SupportGmailClient = {
      async getMessage() {
        return gmailMessage;
      },
      async listInboxMessages() {
        return [{ id: gmailMessage.id!, threadId: gmailMessage.threadId }];
      },
      async sendSupportReply() {
        throw new Error("Not used by sync test.");
      }
    };

    const first = await syncSupportGmailInboxWithClient(client);
    assert.deepEqual(first, { imported: 1, skipped: 0 });

    const storedMessage = await prisma.supportMessage.findUnique({
      where: { gmailMessageId: gmailMessage.id! }
    });
    assert.ok(storedMessage);
    assert.equal(storedMessage.ticketId, ticket.id);
    assert.equal(storedMessage.senderType, "CUSTOMER");
    assert.equal(storedMessage.channel, "EMAIL");
    assert.equal(storedMessage.body, "Here is my follow-up from Gmail.");

    const storedTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    });
    assert.equal(storedTicket.status, "OPEN");
    assert.equal(storedTicket.gmailThreadId, gmailMessage.threadId);

    const second = await syncSupportGmailInboxWithClient(client);
    assert.deepEqual(second, { imported: 0, skipped: 1 });
  } finally {
    await scope.cleanup();
  }
});

test("Gmail inbox sync rejects a sender that does not match the ticket customer", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const ticket = await createCustomerSupportTicket({
      customerName: "Protected Customer",
      customerEmail: "protected-customer@example.com",
      customerPhone: "09171234567",
      category: "ACCOUNT",
      orderNumber: "",
      subject: "Account Concern",
      message: "I need help with my account."
    });

    const gmailMessage: GmailApiMessage = {
      id: "gmail-spoof-" + randomUUID(),
      threadId: "gmail-spoof-thread-" + randomUUID(),
      payload: {
        mimeType: "text/plain",
        headers: [
          { name: "From", value: "Attacker <attacker@example.com>" },
          { name: "Subject", value: `[${ticket.ticketNumber}] Account Concern` }
        ],
        body: {
          data: Buffer.from("Please change this account.", "utf8").toString("base64url")
        }
      }
    };

    const client: SupportGmailClient = {
      async getMessage() {
        return gmailMessage;
      },
      async listInboxMessages() {
        return [{ id: gmailMessage.id!, threadId: gmailMessage.threadId }];
      },
      async sendSupportReply() {
        throw new Error("Not used by sync test.");
      }
    };

    const result = await syncSupportGmailInboxWithClient(client);
    assert.deepEqual(result, { imported: 0, skipped: 1 });
    assert.equal(
      await prisma.supportMessage.count({
        where: { gmailMessageId: gmailMessage.id! }
      }),
      0
    );
  } finally {
    await scope.cleanup();
  }
});
