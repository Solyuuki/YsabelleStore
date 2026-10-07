import type { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type { SupportTicketStatus } from "../types/customerSupport.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  SupportTicketListQuery,
  SupportTicketReplyInput,
  SupportTicketStatusUpdateInput
} from "../validators/customerSupport.validators.js";
import type { SafeUser } from "./authService.js";
import {
  deliverAutomatedSupportAcknowledgementEmail,
  deliverStaffSupportMessageEmail,
  isSupportGmailConfigured,
  isSupportGmailDeliveryEnabled,
  isSupportLocalReplyFallbackAllowed,
  SUPPORT_AUTOMATION_SENDER_NAME
} from "./supportGmailService.js";

const staffSupportTicketDetailSelect = {
  id: true,
  ticketNumber: true,
  customerAccountId: true,
  customerOrderId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  category: true,
  subject: true,
  status: true,
  lastMessageAt: true,
  lastCustomerMessageAt: true,
  lastStaffMessageAt: true,
  lastReadByStaffAt: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  customerAccount: {
    select: {
      id: true,
      name: true,
      email: true,
      status: true
    }
  },
  customerOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true
    }
  },
  messages: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      senderType: true,
      channel: true,
      senderUserId: true,
      senderName: true,
      senderEmail: true,
      body: true,
      deliveryStatus: true,
      deliveryError: true,
      gmailMessageId: true,
      gmailThreadId: true,
      emailSentAt: true,
      createdAt: true,
      senderUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  }
} satisfies Prisma.SupportTicketSelect;

const SUPPORT_STATUS_TRANSITIONS: Record<SupportTicketStatus, readonly SupportTicketStatus[]> = {
  NEW: ["OPEN", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"],
  OPEN: ["WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"],
  WAITING_FOR_CUSTOMER: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"]
};

function staffSupportNotFound() {
  return new HttpError(404, "Support ticket was not found.", {
    code: "SUPPORT_TICKET_NOT_FOUND"
  });
}

export async function listStaffSupportTickets(query: SupportTicketListQuery) {
  const where: Prisma.SupportTicketWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.search
      ? {
          OR: [
            { ticketNumber: { contains: query.search } },
            { customerName: { contains: query.search } },
            { customerEmail: { contains: query.search } },
            { subject: { contains: query.search } }
          ]
        }
      : {})
  };

  const [totalItems, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        ticketNumber: true,
        customerName: true,
        customerEmail: true,
        category: true,
        subject: true,
        status: true,
        lastMessageAt: true,
        lastCustomerMessageAt: true,
        lastStaffMessageAt: true,
        createdAt: true,
        customerOrder: {
          select: {
            orderNumber: true
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      where
    })
  ]);

  return {
    items: tickets.map(({ _count, ...ticket }) => ({
      ...ticket,
      messageCount: _count.messages
    })),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function getStaffSupportTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    select: staffSupportTicketDetailSelect,
    where: { id: ticketId }
  });

  if (!ticket) {
    throw staffSupportNotFound();
  }

  return ticket;
}

export async function replyToStaffSupportTicket(
  ticketId: string,
  input: SupportTicketReplyInput,
  actor: SafeUser,
  now = new Date()
) {
  const gmailConfigured = isSupportGmailConfigured();
  const localFallbackAllowed = isSupportLocalReplyFallbackAllowed();
  if (!gmailConfigured && !localFallbackAllowed) {
    throw new HttpError(503, "Support Gmail integration is not configured.", {
      code: "SUPPORT_GMAIL_NOT_CONFIGURED"
    });
  }

  const shouldDeliverEmail = isSupportGmailDeliveryEnabled();
  const created = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      select: {
        id: true,
        status: true
      },
      where: { id: ticketId }
    });

    if (!ticket) {
      throw staffSupportNotFound();
    }

    if (ticket.status === "CLOSED") {
      throw new HttpError(409, "Closed support tickets must be reopened before replying.", {
        code: "SUPPORT_TICKET_CLOSED"
      });
    }

    const message = await tx.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: "STAFF",
        channel: shouldDeliverEmail ? "EMAIL" : "WEB",
        senderUserId: actor.id,
        senderName: actor.name,
        senderEmail: actor.email,
        body: input.message,
        deliveryStatus: shouldDeliverEmail ? "PENDING" : "NOT_APPLICABLE"
      },
      select: { id: true }
    });

    await tx.supportTicket.update({
      data: {
        status: shouldDeliverEmail ? "OPEN" : "WAITING_FOR_CUSTOMER",
        lastMessageAt: now,
        lastStaffMessageAt: now,
        lastReadByStaffAt: now,
        resolvedAt: null,
        closedAt: null
      },
      where: { id: ticket.id }
    });

    return message;
  });

  if (shouldDeliverEmail) {
    await deliverStaffSupportMessageEmail(created.id);
  }

  return getStaffSupportTicket(ticketId);
}

export async function retryStaffSupportEmail(ticketId: string, messageId: string) {
  if (!isSupportGmailDeliveryEnabled()) {
    throw new HttpError(503, "Support Gmail integration is not configured.", {
      code: "SUPPORT_GMAIL_NOT_CONFIGURED"
    });
  }

  const message = await prisma.supportMessage.findFirst({
    select: {
      id: true,
      senderType: true,
      senderName: true,
      channel: true,
      deliveryStatus: true,
      ticket: {
        select: {
          status: true
        }
      }
    },
    where: {
      id: messageId,
      ticketId
    }
  });

  const automatedAcknowledgement =
    message?.senderType === "SYSTEM" &&
    message.channel === "EMAIL" &&
    message.senderName === SUPPORT_AUTOMATION_SENDER_NAME;

  if (!message || (message.senderType !== "STAFF" && !automatedAcknowledgement)) {
    throw new HttpError(404, "Support message was not found.", {
      code: "SUPPORT_MESSAGE_NOT_FOUND"
    });
  }

  if (message.ticket.status === "CLOSED") {
    throw new HttpError(409, "Closed support tickets must be reopened before retrying email.", {
      code: "SUPPORT_TICKET_CLOSED"
    });
  }

  if (message.deliveryStatus === "SENT") {
    return getStaffSupportTicket(ticketId);
  }

  if (message.deliveryStatus === "PENDING") {
    throw new HttpError(409, "Support email delivery is already pending.", {
      code: "SUPPORT_EMAIL_DELIVERY_PENDING"
    });
  }

  if (message.deliveryStatus !== "FAILED") {
    throw new HttpError(409, "This support message does not have a retryable email failure.", {
      code: "SUPPORT_EMAIL_NOT_RETRYABLE"
    });
  }

  const claimed = await prisma.supportMessage.updateMany({
    data: {
      channel: "EMAIL",
      deliveryStatus: "PENDING",
      deliveryError: null
    },
    where: {
      id: message.id,
      ticketId,
      channel: "EMAIL",
      deliveryStatus: "FAILED"
    }
  });

  if (claimed.count !== 1) {
    throw new HttpError(409, "Support email delivery is already being retried.", {
      code: "SUPPORT_EMAIL_DELIVERY_PENDING"
    });
  }

  if (automatedAcknowledgement) {
    await deliverAutomatedSupportAcknowledgementEmail(message.id);
  } else {
    await deliverStaffSupportMessageEmail(message.id);
  }
  return getStaffSupportTicket(ticketId);
}

export async function updateStaffSupportTicketStatus(
  ticketId: string,
  input: SupportTicketStatusUpdateInput,
  actor: SafeUser,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      select: {
        id: true,
        status: true,
        resolvedAt: true
      },
      where: { id: ticketId }
    });

    if (!ticket) {
      throw staffSupportNotFound();
    }

    if (ticket.status === input.status) {
      return tx.supportTicket.findUniqueOrThrow({
        select: staffSupportTicketDetailSelect,
        where: { id: ticket.id }
      });
    }

    if (!SUPPORT_STATUS_TRANSITIONS[ticket.status].includes(input.status)) {
      throw new HttpError(409, "Support ticket status transition is not allowed.", {
        code: "INVALID_SUPPORT_STATUS_TRANSITION",
        details: {
          currentStatus: ticket.status,
          requestedStatus: input.status,
          allowedStatuses: SUPPORT_STATUS_TRANSITIONS[ticket.status]
        }
      });
    }

    await tx.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: "SYSTEM",
        channel: "SYSTEM",
        senderUserId: actor.id,
        senderName: actor.name,
        senderEmail: actor.email,
        body: `Status changed from ${ticket.status} to ${input.status} by ${actor.name}.`,
        deliveryStatus: "NOT_APPLICABLE"
      }
    });

    await tx.supportTicket.update({
      data: {
        status: input.status,
        lastMessageAt: now,
        lastReadByStaffAt: now,
        resolvedAt:
          input.status === "RESOLVED" ? now : input.status === "CLOSED" ? ticket.resolvedAt : null,
        closedAt: input.status === "CLOSED" ? now : null
      },
      where: { id: ticket.id }
    });

    return tx.supportTicket.findUniqueOrThrow({
      select: staffSupportTicketDetailSelect,
      where: { id: ticket.id }
    });
  });
}
