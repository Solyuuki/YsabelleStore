import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { loginWithPassword } from "../src/services/authService.js";
import { createCustomerSupportTicket } from "../src/services/customerSupportService.js";
import { hashPassword } from "../src/services/passwordHashService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

const PASSWORD = "InternalSupport123!";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createInternalSession(role: "OWNER" | "STAFF" = "STAFF") {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      name: `Support ${role} ${suffix}`,
      email: `support-${role.toLowerCase()}-${suffix}@example.com`,
      passwordHash: await hashPassword(PASSWORD),
      role,
      status: "ACTIVE"
    }
  });
  const session = await loginWithPassword({
    email: user.email,
    password: PASSWORD
  });
  return { session, user };
}

function authHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

async function createTicket() {
  return createCustomerSupportTicket({
    customerName: "Phase Three Customer",
    customerEmail: "phase-three-customer@example.com",
    customerPhone: "09171234567",
    category: "ORDER",
    orderNumber: "",
    subject: "Need help with pickup",
    message: "I need help confirming when my pickup order will be ready."
  });
}

test("support inbox requires an internal staff or owner bearer token", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/support/tickets`);
    const body = (await response.json()) as { error?: { code?: string } };

    assert.equal(response.status, 401);
    assert.equal(body.error?.code, "AUTH_TOKEN_REQUIRED");
  });
});

test("staff can filter tickets, open a conversation, reply, and resolve it", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { session, user } = await createInternalSession("STAFF");
    const ticket = await createTicket();

    await withServer(async (baseUrl) => {
      const listResponse = await fetch(
        `${baseUrl}/api/support/tickets?status=NEW&category=ORDER&search=${encodeURIComponent(ticket.ticketNumber)}`,
        {
          headers: authHeader(session.token)
        }
      );
      assert.equal(listResponse.status, 200);
      const listBody = (await listResponse.json()) as {
        data?: Array<{ id?: string; ticketNumber?: string; status?: string }>;
      };
      assert.equal(listBody.data?.length, 1);
      assert.equal(listBody.data?.[0]?.id, ticket.id);

      const detailResponse = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}`, {
        headers: authHeader(session.token)
      });
      assert.equal(detailResponse.status, 200);

      const replyResponse = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/replies`, {
        method: "POST",
        headers: {
          ...authHeader(session.token),
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: "Your pickup request is being reviewed by the store team."
        })
      });
      assert.equal(replyResponse.status, 200);
      const replyBody = (await replyResponse.json()) as {
        data?: {
          status?: string;
          messages?: Array<{
            senderType?: string;
            senderUserId?: string | null;
            body?: string;
          }>;
        };
      };
      assert.equal(replyBody.data?.status, "WAITING_FOR_CUSTOMER");
      assert.equal(
        replyBody.data?.messages?.some(
          (message) =>
            message.senderType === "STAFF" &&
            message.senderUserId === user.id &&
            message.body === "Your pickup request is being reviewed by the store team."
        ),
        true
      );

      // Staff selection must not resolve a ticket directly. Without an
      // externally reachable confirmation URL, the request is rejected safely.
      const resolveResponse = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/status`, {
        method: "PATCH",
        headers: {
          ...authHeader(session.token),
          "content-type": "application/json"
        },
        body: JSON.stringify({ status: "RESOLVED" })
      });
      assert.equal(resolveResponse.status, 503);
      const unchanged = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: ticket.id }
      });
      assert.equal(unchanged.status, "WAITING_FOR_CUSTOMER");
    });
  } finally {
    await scope.cleanup();
  }
});

test("closed support ticket blocks replies until staff explicitly reopens it", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { session } = await createInternalSession("OWNER");
    const ticket = await createTicket();

    await withServer(async (baseUrl) => {
      const headers = {
        ...authHeader(session.token),
        "content-type": "application/json"
      };

      const closeResponse = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "CLOSED" })
      });
      assert.equal(closeResponse.status, 200);

      const blockedReply = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/replies`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "This should not be accepted while closed." })
      });
      assert.equal(blockedReply.status, 409);
      const blockedBody = (await blockedReply.json()) as { error?: { code?: string } };
      assert.equal(blockedBody.error?.code, "SUPPORT_TICKET_CLOSED");

      const reopenResponse = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "OPEN" })
      });
      assert.equal(reopenResponse.status, 200);

      const replyResponse = await fetch(`${baseUrl}/api/support/tickets/${ticket.id}/replies`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "The reopened ticket can receive a staff reply." })
      });
      assert.equal(replyResponse.status, 200);
    });
  } finally {
    await scope.cleanup();
  }
});
