import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { registerCustomer } from "../src/services/customerAuthService.js";

const CUSTOMER_COOKIE_NAME = "ysabelle_customer_session";
const PASSWORD = "CustomerPass123!";

type OrderApiBody = {
  success?: boolean;
  data?:
    | Array<{
        id?: string;
        orderNumber?: string;
        status?: string;
        totalAmount?: string;
        items?: Array<{ productId?: string; productName?: string; quantity?: number }>;
      }>
    | {
        id?: string;
        orderNumber?: string;
      };
};

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

async function createFixture() {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.category.create({
    data: {
      name: `Customer Order Test ${suffix}`,
      slug: `customer-order-test-${suffix}`,
      isActive: true,
      recordSource: "CATALOG",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true
    }
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      sku: `CUSTOMER-ORDER-${suffix}`,
      name: `Customer Order Product ${suffix}`,
      imageUrl: `/images/products/customer-order-${suffix}.webp`,
      unit: "PIECE",
      costPrice: "10.00",
      sellingPrice: "15.00",
      reorderLevel: 2,
      targetStockLevel: 8,
      status: "ACTIVE",
      recordSource: "CATALOG",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true,
      inventory: { create: { quantityOnHand: 8 } },
      inventoryBatches: {
        create: {
          batchCode: `CUSTOMER-ORDER-BATCH-${suffix}`,
          quantityReceived: 8,
          quantityRemaining: 8,
          unitCost: "10.00",
          status: "AVAILABLE"
        }
      }
    }
  });
  const customerA = await registerCustomer({
    name: "Customer A",
    email: `customer-a-${suffix}@example.com`,
    phone: "09171234567",
    password: PASSWORD
  });
  const customerB = await registerCustomer({
    name: "Customer B",
    email: `customer-b-${suffix}@example.com`,
    phone: "09179876543",
    password: PASSWORD
  });

  return { category, customerA, customerB, product };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.customerOrder.deleteMany({
    where: { items: { some: { productId: fixture.product.id } } }
  });
  await prisma.customerSession.deleteMany({
    where: {
      customerAccountId: { in: [fixture.customerA.customer.id, fixture.customerB.customer.id] }
    }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: [fixture.customerA.customer.id, fixture.customerB.customer.id] } }
  });
  await prisma.inventoryBatch.deleteMany({ where: { productId: fixture.product.id } });
  await prisma.inventory.deleteMany({ where: { productId: fixture.product.id } });
  await prisma.product.delete({ where: { id: fixture.product.id } });
  await prisma.category.delete({ where: { id: fixture.category.id } });
}

function orderInput(productId: string, customerName: string) {
  return {
    customerName,
    customerEmail: `${customerName.toLowerCase().replaceAll(" ", "-")}@example.com`,
    customerPhone: "09171234567",
    fulfillmentMethod: "STORE_PICKUP",
    paymentMethod: "CASH_ON_PICKUP",
    items: [{ productId, quantity: 1 }]
  };
}

test("authenticated storefront checkout links the order to the signed-in customer", async () => {
  const fixture = await createFixture();

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/storefront/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Cookie: customerCookie(fixture.customerA.sessionToken)
        },
        body: JSON.stringify(orderInput(fixture.product.id, "Customer A Checkout"))
      });

      assert.equal(response.status, 201);
      const body = (await response.json()) as OrderApiBody;
      assert.ok(body.data && !Array.isArray(body.data));
      const order = await prisma.customerOrder.findUniqueOrThrow({
        where: { id: body.data.id }
      });

      assert.equal(order.customerAccountId, fixture.customerA.customer.id);
    });
  } finally {
    await cleanupFixture(fixture);
  }
});

test("customer order history is strictly isolated to the authenticated customer", async () => {
  const fixture = await createFixture();

  try {
    const ownedOrder = await prisma.customerOrder.create({
      data: {
        customerAccountId: fixture.customerA.customer.id,
        orderNumber: `YS-ACCOUNT-${randomUUID().slice(0, 8).toUpperCase()}`,
        customerName: "Customer A",
        customerEmail: fixture.customerA.customer.email,
        customerPhone: "09171234567",
        fulfillmentMethod: "STORE_PICKUP",
        paymentMethod: "CASH_ON_PICKUP",
        status: "PENDING",
        subtotalAmount: "15.00",
        totalAmount: "15.00",
        items: {
          create: {
            productId: fixture.product.id,
            quantity: 1,
            unitPrice: "15.00",
            totalAmount: "15.00"
          }
        }
      }
    });

    await withServer(async (baseUrl) => {
      const customerAHistory = await fetch(`${baseUrl}/api/customer-account/orders`, {
        headers: { Cookie: customerCookie(fixture.customerA.sessionToken) }
      });
      assert.equal(customerAHistory.status, 200);
      const customerABody = (await customerAHistory.json()) as OrderApiBody;
      assert.ok(Array.isArray(customerABody.data));
      assert.equal(
        customerABody.data.some((order) => order.id === ownedOrder.id),
        true
      );
      const serializedOwnedOrder = customerABody.data.find((order) => order.id === ownedOrder.id);
      assert.equal(serializedOwnedOrder?.items?.[0]?.productName, fixture.product.name);

      const customerBHistory = await fetch(`${baseUrl}/api/customer-account/orders`, {
        headers: { Cookie: customerCookie(fixture.customerB.sessionToken) }
      });
      assert.equal(customerBHistory.status, 200);
      const customerBBody = (await customerBHistory.json()) as OrderApiBody;
      assert.ok(Array.isArray(customerBBody.data));
      assert.equal(
        customerBBody.data.some((order) => order.id === ownedOrder.id),
        false
      );

      const anonymousHistory = await fetch(`${baseUrl}/api/customer-account/orders`);
      assert.equal(anonymousHistory.status, 401);
    });
  } finally {
    await cleanupFixture(fixture);
  }
});

test("guest storefront checkout remains public and leaves customer ownership null", async () => {
  const fixture = await createFixture();

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/storefront/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orderInput(fixture.product.id, "Guest Checkout"))
      });

      assert.equal(response.status, 201);
      const body = (await response.json()) as OrderApiBody;
      assert.ok(body.data && !Array.isArray(body.data));
      const order = await prisma.customerOrder.findUniqueOrThrow({
        where: { id: body.data.id }
      });

      assert.equal(order.customerAccountId, null);
    });
  } finally {
    await cleanupFixture(fixture);
  }
});
