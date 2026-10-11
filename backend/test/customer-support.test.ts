import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { registerCustomer } from "../src/services/customerAuthService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

const CUSTOMER_COOKIE_NAME = "ysabelle_customer_session";
const PASSWORD = "CustomerPass123!";

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

function customerCookie(sessionToken: string) {
  return `${CUSTOMER_COOKIE_NAME}=${sessionToken}`;
}

function supportInput(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Support Guest",
    customerEmail: "support.guest@example.com",
    customerPhone: "09171234567",
    category: "ORDER",
    subject: "Question about my order",
    message: "I need help checking the status of my recent store order.",
    ...overrides
  };
}

test("guest support request creates a NEW ticket with a customer web message", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/customer-support/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(supportInput())
      });

      assert.equal(response.status, 201);
      const body = (await response.json()) as {
        success?: boolean;
        data?: { id?: string; ticketNumber?: string; status?: string };
      };
      assert.equal(body.success, true);
      assert.match(body.data?.ticketNumber ?? "", /^YS-CS-\d{6}$/);
      assert.equal(body.data?.status, "NEW");
      assert.ok(body.data?.id);

      const ticket = await prisma.supportTicket.findUniqueOrThrow({
        include: { messages: { orderBy: { createdAt: "asc" } } },
        where: { id: body.data.id }
      });

      assert.equal(ticket.customerAccountId, null);
      assert.equal(ticket.customerName, "Support Guest");
      assert.equal(ticket.customerEmail, "support.guest@example.com");
      assert.equal(ticket.messages.length, 1);
      assert.equal(ticket.messages[0]?.senderType, "CUSTOMER");
      assert.equal(ticket.messages[0]?.channel, "WEB");
      assert.equal(
        ticket.messages[0]?.body,
        "I need help checking the status of my recent store order."
      );
    });
  } finally {
    await scope.cleanup();
  }
});

test("signed-in support request uses account identity and links an owned order", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const registered = await registerCustomer({
      name: "Verified Support Customer",
      username: `support.${suffix}`,
      email: `support-${suffix}@example.com`,
      phone: `0917${Number.parseInt(suffix, 16).toString().slice(-7).padStart(7, "0")}`,
      password: PASSWORD
    });
    const preferredContactPhone = "09981234567";
    await prisma.customerAccount.update({
      data: { defaultContactPhone: preferredContactPhone },
      where: { id: registered.customer.id }
    });

    const orderNumber = `YS-SUPPORT-${suffix.toUpperCase()}`;
    const order = await prisma.customerOrder.create({
      data: {
        customerAccountId: registered.customer.id,
        orderNumber,
        deliveryTicketNumber: `DEL-${orderNumber}`,
        customerName: registered.customer.name,
        customerEmail: registered.customer.email,
        customerPhone: registered.customer.phone ?? "09171234567",
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "CASH_ON_DELIVERY",
        status: "PENDING",
        subtotalAmount: "0.00",
        totalAmount: "0.00"
      }
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/customer-support/tickets`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Cookie: customerCookie(registered.sessionToken)
        },
        body: JSON.stringify(
          supportInput({
            customerName: "Spoofed Name",
            customerEmail: "someone-else@example.com",
            customerPhone: "09999999999",
            orderNumber
          })
        )
      });

      assert.equal(response.status, 201);
      const body = (await response.json()) as { data?: { id?: string } };
      assert.ok(body.data?.id);

      const ticket = await prisma.supportTicket.findUniqueOrThrow({
        include: { messages: { orderBy: { createdAt: "asc" } } },
        where: { id: body.data.id }
      });

      assert.equal(ticket.customerAccountId, registered.customer.id);
      assert.equal(ticket.customerOrderId, order.id);
      assert.equal(ticket.customerName, registered.customer.name);
      assert.equal(ticket.customerEmail, registered.customer.email);
      assert.equal(ticket.customerPhone, preferredContactPhone);
      assert.equal(ticket.messages[0]?.senderType, "CUSTOMER");
      assert.equal(ticket.messages[1]?.senderType, "SYSTEM");
      assert.match(ticket.messages[1]?.body ?? "", new RegExp(orderNumber));
      assert.match(ticket.messages[1]?.body ?? "", /Verified order reference linked/);
    });
  } finally {
    await scope.cleanup();
  }
});

test("invalid support request is rejected before ticket persistence", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/customer-support/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          supportInput({
            subject: "No",
            message: "short"
          })
        )
      });

      assert.equal(response.status, 400);
      const body = (await response.json()) as { error?: { code?: string } };
      assert.equal(body.error?.code, "INVALID_CUSTOMER_SUPPORT_REQUEST");
      assert.equal(
        await prisma.supportTicket.count({ where: { customerEmail: "support.guest@example.com" } }),
        0
      );
    });
  } finally {
    await scope.cleanup();
  }
});
