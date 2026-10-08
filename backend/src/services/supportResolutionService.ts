import { randomUUID } from "node:crypto";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { SafeUser } from "./authService.js";
import {
  deliverStaffSupportMessageEmail,
  isSupportGmailDeliveryEnabled
} from "./supportGmailService.js";

const CONFIRMATION_TTL_MS = 72 * 60 * 60 * 1000;
export const REQUEST_PREFIX = "YS_SUPPORT_RESOLUTION_EMAIL_REPLY:";

export async function requestSupportResolutionConfirmation(
  ticketId: string,
  actor: SafeUser,
  now = new Date()
) {
  if (!isSupportGmailDeliveryEnabled()) {
    throw new HttpError(503, "Support Gmail delivery is required for confirmation.", {
      code: "SUPPORT_GMAIL_NOT_CONFIGURED"
    });
  }

  const messageId = randomUUID();
  const message = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, customerName: true }
    });
    if (!ticket) {
      throw new HttpError(404, "Support ticket was not found.", {
        code: "SUPPORT_TICKET_NOT_FOUND"
      });
    }
    if (!["OPEN", "WAITING_FOR_CUSTOMER", "NEW"].includes(ticket.status)) {
      throw new HttpError(409, "Only active tickets can request resolution confirmation.", {
        code: "INVALID_SUPPORT_RESOLUTION_REQUEST"
      });
    }

    const previousRequest = await tx.supportMessage.findFirst({
      where: { ticketId, body: { startsWith: REQUEST_PREFIX } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { deliveryStatus: true, emailSentAt: true }
    });
    if (
      previousRequest?.deliveryStatus === "SENT" &&
      previousRequest.emailSentAt &&
      ticket.status === "WAITING_FOR_CUSTOMER" &&
      now.getTime() - previousRequest.emailSentAt.getTime() < CONFIRMATION_TTL_MS
    ) {
      throw new HttpError(409, "The customer has already been asked to confirm resolution.", {
        code: "SUPPORT_CONFIRMATION_ALREADY_PENDING"
      });
    }

    const created = await tx.supportMessage.create({
      data: {
        id: messageId,
        ticketId,
        senderType: "STAFF",
        channel: "EMAIL",
        senderUserId: actor.id,
        senderName: actor.name,
        senderEmail: actor.email,
        body: `${REQUEST_PREFIX}
Hello ${ticket.customerName},

Has your concern been resolved? Reply to this email with exactly YES or NO on the first line.

YES — My concern has been resolved.
NO — I still need assistance.

We'll process your response in this same conversation. Please reply within 72 hours.`,
        deliveryStatus: "PENDING"
      },
      select: { id: true }
    });
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "OPEN",
        resolvedAt: null,
        closedAt: null,
        lastStaffMessageAt: now,
        lastMessageAt: now
      }
    });
    return created;
  });

  await deliverStaffSupportMessageEmail(message.id);
  return prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
}
