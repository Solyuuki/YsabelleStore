import { randomInt } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type { SafeCustomer } from "./customerAuthService.js";
import type { CustomerSupportTicketCreateInput } from "../validators/customerSupport.validators.js";

const SUPPORT_TICKET_NUMBER_ATTEMPTS = 8;

type CustomerSupportContext = {
  customer?: SafeCustomer;
};

type ResolvedOrderReference = {
  customerOrderId: string | null;
  systemMessage: string | null;
};

function createSupportTicketNumber() {
  const numeric = randomInt(1, 1_000_000);
  return `YS-CS-${numeric.toString().padStart(6, "0")}`;
}

function normalizeOptional(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function resolveOrderReference(
  tx: Prisma.TransactionClient,
  orderNumber: string | null,
  customer: SafeCustomer | undefined,
  customerEmail: string
): Promise<ResolvedOrderReference> {
  if (!orderNumber) {
    return { customerOrderId: null, systemMessage: null };
  }

  const order = await tx.customerOrder.findUnique({
    select: {
      id: true,
      customerAccountId: true,
      customerEmail: true
    },
    where: { orderNumber }
  });

  const linked = Boolean(
    order &&
    (customer
      ? order.customerAccountId === customer.id
      : order.customerEmail?.trim().toLowerCase() === customerEmail)
  );

  return {
    customerOrderId: linked && order ? order.id : null,
    systemMessage: linked
      ? `Verified order reference linked: ${orderNumber}`
      : `Unverified order reference provided by customer: ${orderNumber}`
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCustomerSupportTicket(
  input: CustomerSupportTicketCreateInput,
  context: CustomerSupportContext = {}
) {
  const customer = context.customer;
  const customerName = customer?.name ?? input.customerName.trim();
  const customerEmail = (customer?.email ?? input.customerEmail).trim().toLowerCase();
  const customerPhone = customer ? customer.phone : normalizeOptional(input.customerPhone);
  const orderNumber = normalizeOptional(input.orderNumber);

  for (let attempt = 0; attempt < SUPPORT_TICKET_NUMBER_ATTEMPTS; attempt += 1) {
    const ticketNumber = createSupportTicketNumber();
    const now = new Date();

    try {
      return await prisma.$transaction(async (tx) => {
        const orderReference = await resolveOrderReference(
          tx,
          orderNumber,
          customer,
          customerEmail
        );
        const messages = [
          {
            senderType: "CUSTOMER" as const,
            channel: "WEB" as const,
            senderName: customerName,
            senderEmail: customerEmail,
            body: input.message
          },
          ...(orderReference.systemMessage
            ? [
                {
                  senderType: "SYSTEM" as const,
                  channel: "SYSTEM" as const,
                  senderName: null,
                  senderEmail: null,
                  body: orderReference.systemMessage
                }
              ]
            : [])
        ];

        return tx.supportTicket.create({
          data: {
            ticketNumber,
            customerAccountId: customer?.id ?? null,
            customerOrderId: orderReference.customerOrderId,
            customerName,
            customerEmail,
            customerPhone,
            category: input.category,
            subject: input.subject,
            status: "NEW",
            lastMessageAt: now,
            lastCustomerMessageAt: now,
            messages: {
              create: messages
            }
          },
          select: {
            id: true,
            ticketNumber: true,
            category: true,
            status: true,
            subject: true,
            createdAt: true
          }
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < SUPPORT_TICKET_NUMBER_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to allocate a unique customer support ticket reference.");
}
