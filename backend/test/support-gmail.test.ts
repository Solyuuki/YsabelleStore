import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { createCustomerSupportTicket } from "../src/services/customerSupportService.js";
import {
  createSupportGmailClient,
  deliverStaffSupportMessageEmail,
  syncSupportGmailInboxWithClient,
  type GmailApiMessage,
  type SupportGmailClient
} from "../src/services/supportGmailService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

test("Gmail client caches the access token and sends a threaded canonical ticket reply", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(
        JSON.stringify({ access_token: "gmail-access-token", expires_in: 3600 }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.includes("/messages/gmail-prior?format=metadata")) {
      return new Response(
        JSON.stringify({
          id: "gmail-prior",
          threadId: "gmail-thread-1",
          payload: {
            headers: [{ name: "Message-ID", value: "<prior-message@example.com>" }]
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
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
    body: "We are reviewing your payment concern.",
    threadId: "gmail-thread-1",
    replyToGmailMessageId: "gmail-prior"
  });

  assert.deepEqual(result, {
    id: "gmail-message-1",
    threadId: "gmail-thread-1"
  });

  const tokenCalls = calls.filter((call) => call.url === "https://oauth2.googleapis.com/token");
  assert.equal(tokenCalls.length, 1);
  assert.match(String(tokenCalls[0]?.init?.body), /grant_type=refresh_token/);

  const sendCall = calls.find((call) => call.url.includes("/messages/send"));
  assert.ok(sendCall);
  const sendBody = JSON.parse(String(sendCall.init?.body)) as {
    raw?: string;
    threadId?: string;
  };
  assert.equal(sendBody.threadId, "gmail-thread-1");
  assert.ok(sendBody.raw);
  const rawEmail = Buffer.from(sendBody.raw, "base64url").toString("utf8");
  assert.match(rawEmail, /To: customer@example\.com/);
  assert.match(rawEmail, /Subject: =\?UTF-8\?B\?/);
  assert.match(rawEmail, /In-Reply-To: <prior-message@example\.com>/);
  assert.match(
    Buffer.from(
      rawEmail
        .match(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]+?)\r\n$/)?.[1]
        ?.replace(/\r\n/g, "") ?? "",
      "base64"
    ).toString("utf8"),
    /YS-CS-000124/
  );
});

test("Gmail inbox listing paginates, deduplicates, and reuses one access token", async () => {
  let tokenCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);

    if (url === "https://oauth2.googleapis.com/token") {
      tokenCalls += 1;
      return new Response(
        JSON.stringify({ access_token: "gmail-access-token", expires_in: 3600 }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages?")) {
      const requestUrl = new URL(url);
      const pageToken = requestUrl.searchParams.get("pageToken");
      if (!pageToken) {
        return new Response(
          JSON.stringify({
            messages: [
              { id: "message-1", threadId: "thread-1" },
              { id: "message-2", threadId: "thread-2" }
            ],
            nextPageToken: "page-2"
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      assert.equal(pageToken, "page-2");
      return new Response(
        JSON.stringify({
          messages: [
            { id: "message-2", threadId: "thread-2" },
            { id: "message-3", threadId: "thread-3" }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
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

  const messages = await client.listInboxMessages();
  assert.deepEqual(
    messages.map((message) => message.id),
    ["message-1", "message-2", "message-3"]
  );
  assert.equal(tokenCalls, 1);
});

test("Gmail client invalidates a rejected access token and retries once", async () => {
  let tokenCalls = 0;
  let gmailCalls = 0;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);

    if (url === "https://oauth2.googleapis.com/token") {
      tokenCalls += 1;
      return new Response(
        JSON.stringify({
          access_token: tokenCalls === 1 ? "stale-token" : "fresh-token",
          expires_in: 3600
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages?")) {
      gmailCalls += 1;
      const authorization = new Headers(init?.headers).get("authorization");
      if (authorization === "Bearer stale-token") {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 401,
          headers: { "content-type": "application/json" }
        });
      }

      assert.equal(authorization, "Bearer fresh-token");
      return new Response(JSON.stringify({ messages: [] }), {
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

  assert.deepEqual(await client.listInboxMessages(), []);
  assert.equal(tokenCalls, 2);
  assert.equal(gmailCalls, 2);
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

    const inboundBody = `Here is my follow-up from Gmail. ${"x".repeat(5_200)}`;
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
              data: Buffer.from(inboundBody, "utf8").toString("base64url")
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
    assert.equal(storedMessage.body.length, 5_000);
    assert.equal(storedMessage.body.endsWith("…"), true);
    assert.equal(storedMessage.body.startsWith("Here is my follow-up from Gmail."), true);

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

async function createPendingSupportEmail(label: string) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const ticket = await createCustomerSupportTicket({
    customerName: `${label} Customer`,
    customerEmail: `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@example.com`,
    customerPhone: "09171234567",
    category: "OTHER",
    orderNumber: "",
    subject: `${label} delivery lifecycle`,
    message: "Please help me test the support email delivery lifecycle."
  });

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderType: "STAFF",
      channel: "EMAIL",
      senderName: "Support Staff",
      senderEmail: "support@example.com",
      body: "This is a support reply sent through Gmail.",
      deliveryStatus: "PENDING"
    }
  });

  await prisma.supportTicket.update({
    data: { status: "OPEN" },
    where: { id: ticket.id }
  });

  return { ticket, message };
}

test("successful Gmail delivery marks the message sent and waits for the customer", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { ticket, message } = await createPendingSupportEmail("Successful");
    const client: SupportGmailClient = {
      async getMessage() {
        throw new Error("Not used by delivery test.");
      },
      async listInboxMessages() {
        return [];
      },
      async sendSupportReply() {
        return {
          id: "gmail-sent-" + randomUUID(),
          threadId: "gmail-thread-" + randomUUID()
        };
      }
    };

    const result = await deliverStaffSupportMessageEmail(message.id, client);
    assert.equal(result.status, "SENT");

    const storedMessage = await prisma.supportMessage.findUniqueOrThrow({
      where: { id: message.id }
    });
    assert.equal(storedMessage.deliveryStatus, "SENT");
    assert.ok(storedMessage.gmailMessageId);
    assert.ok(storedMessage.gmailThreadId);
    assert.ok(storedMessage.emailSentAt);
    assert.equal(storedMessage.deliveryError, null);

    const storedTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    });
    assert.equal(storedTicket.status, "WAITING_FOR_CUSTOMER");
    assert.equal(storedTicket.gmailThreadId, storedMessage.gmailThreadId);
  } finally {
    await scope.cleanup();
  }
});

test("failed Gmail delivery stays actionable and does not claim the customer was contacted", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { ticket, message } = await createPendingSupportEmail("Failed");
    const client: SupportGmailClient = {
      async getMessage() {
        throw new Error("Not used by delivery test.");
      },
      async listInboxMessages() {
        return [];
      },
      async sendSupportReply() {
        throw new Error("Simulated Gmail outage.");
      }
    };

    const result = await deliverStaffSupportMessageEmail(message.id, client);
    assert.equal(result.status, "FAILED");

    const storedMessage = await prisma.supportMessage.findUniqueOrThrow({
      where: { id: message.id }
    });
    assert.equal(storedMessage.deliveryStatus, "FAILED");
    assert.equal(storedMessage.channel, "EMAIL");
    assert.equal(storedMessage.gmailMessageId, null);
    assert.equal(storedMessage.emailSentAt, null);
    assert.match(storedMessage.deliveryError ?? "", /retry/i);

    const storedTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    });
    assert.equal(storedTicket.status, "OPEN");
  } finally {
    await scope.cleanup();
  }
});

test("Gmail delivery failure never reopens a ticket that staff closed concurrently", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { ticket, message } = await createPendingSupportEmail("Closed");
    await prisma.supportTicket.update({
      data: {
        status: "CLOSED",
        closedAt: new Date()
      },
      where: { id: ticket.id }
    });

    const client: SupportGmailClient = {
      async getMessage() {
        throw new Error("Not used by delivery test.");
      },
      async listInboxMessages() {
        return [];
      },
      async sendSupportReply() {
        throw new Error("Simulated Gmail outage.");
      }
    };

    await deliverStaffSupportMessageEmail(message.id, client);

    const storedTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id }
    });
    assert.equal(storedTicket.status, "CLOSED");
    assert.ok(storedTicket.closedAt);
  } finally {
    await scope.cleanup();
  }
});
