import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { SafeUser } from "./authService.js";
import { deliverStaffSupportMessageEmail, isSupportGmailDeliveryEnabled } from "./supportGmailService.js";

const CONFIRMATION_TTL_MS = 72 * 60 * 60 * 1000;
const REQUEST_PREFIX = "YS_SUPPORT_RESOLUTION_REQUEST:";
const CONFIRMED_PREFIX = "YS_SUPPORT_RESOLUTION_CONFIRMED:";
const NEEDS_HELP_PREFIX = "YS_SUPPORT_RESOLUTION_NEEDS_HELP:";

function signingKey() {
  const key = env.CUSTOMER_OAUTH_TRANSACTION_KEY ?? env.JWT_SECRET;
  if (!key || key.length < 32) {
    throw new HttpError(503, "Support confirmation signing key is not configured.", {
      code: "SUPPORT_CONFIRMATION_NOT_CONFIGURED"
    });
  }
  return key;
}

function publicBaseUrl() {
  const base = env.SUPPORT_PUBLIC_BACKEND_URL
    ?? (env.NODE_ENV === "production" ? null : "http://localhost:3001");
  if (!base) {
    throw new HttpError(503, "Support public backend URL is not configured.", {
      code: "SUPPORT_CONFIRMATION_NOT_CONFIGURED"
    });
  }
  return base.replace(/\/$/, "");
}

function signature(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createResolutionToken(ticketId: string, requestId: string, issuedAt = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ticketId, requestId, issuedAt }), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function readResolutionToken(token: string, now = Date.now()) {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra || token.length > 2048) return null;
  const expected = signature(payload);
  const received = Buffer.from(mac, "utf8");
  const valid = Buffer.from(expected, "utf8");
  if (received.length !== valid.length || !timingSafeEqual(received, valid)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.ticketId !== "string" || typeof value.requestId !== "string" ||
      typeof value.issuedAt !== "number" || !Number.isSafeInteger(value.issuedAt) ||
      value.issuedAt > now + 60_000 || now - value.issuedAt > CONFIRMATION_TTL_MS) return null;
    return { ticketId: value.ticketId, requestId: value.requestId };
  } catch {
    return null;
  }
}

export async function requestSupportResolutionConfirmation(ticketId: string, actor: SafeUser, now = new Date()) {
  // Fail before writing a request that would contain unusable links.
  signingKey();
  const base = publicBaseUrl();
  if (!isSupportGmailDeliveryEnabled()) {
    throw new HttpError(503, "Support Gmail delivery is required for confirmation.", {
      code: "SUPPORT_GMAIL_NOT_CONFIGURED"
    });
  }

  const requestId = randomUUID();
  const token = createResolutionToken(ticketId, requestId, now.getTime());
  const confirmationUrl = `${base}/api/customer-support/resolution?token=${encodeURIComponent(token)}`;
  const yesUrl = `${confirmationUrl}&answer=YES`;
  const noUrl = `${confirmationUrl}&answer=NO`;
  const message = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, customerName: true }
    });
    if (!ticket) throw new HttpError(404, "Support ticket was not found.", { code: "SUPPORT_TICKET_NOT_FOUND" });
    if (!["OPEN", "WAITING_FOR_CUSTOMER", "NEW"].includes(ticket.status)) {
      throw new HttpError(409, "Only active support tickets can request resolution confirmation.", { code: "INVALID_SUPPORT_RESOLUTION_REQUEST" });
    }
    const previousRequest = await tx.supportMessage.findFirst({
      where: { ticketId, body: { startsWith: REQUEST_PREFIX } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { deliveryStatus: true, createdAt: true }
    });
    if (
      ticket.status === "WAITING_FOR_CUSTOMER" &&
      previousRequest?.deliveryStatus === "SENT" &&
      now.getTime() - previousRequest.createdAt.getTime() < CONFIRMATION_TTL_MS
    ) {
      throw new HttpError(409, "A resolution confirmation is already awaiting the customer.", {
        code: "SUPPORT_CONFIRMATION_ALREADY_PENDING"
      });
    }
    const created = await tx.supportMessage.create({
      data: {
        id: requestId,
        ticketId,
        senderType: "STAFF",
        channel: "EMAIL",
        senderUserId: actor.id,
        senderName: actor.name,
        senderEmail: actor.email,
        body: `${REQUEST_PREFIX}\nHello ${ticket.customerName},\n\nHas your support concern been resolved? Choose Yes or No using the links below. Both links expire in 72 hours.\n\nYes, resolved: ${yesUrl}\nNo, I need more help: ${noUrl}\n\nIf you still need help, our team will continue assisting you.`,
        deliveryStatus: "PENDING"
      },
      select: { id: true }
    });
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: "OPEN", resolvedAt: null, closedAt: null, lastStaffMessageAt: now, lastMessageAt: now }
    });
    return created;
  });

  await deliverStaffSupportMessageEmail(message.id);
  return prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
}

export async function inspectResolutionToken(token: string, now = new Date()) {
  const parsed = readResolutionToken(token, now.getTime());
  if (!parsed) return null;
  const [request, ticket] = await Promise.all([
    prisma.supportMessage.findUnique({ where: { id: parsed.requestId } }),
    prisma.supportTicket.findUnique({ where: { id: parsed.ticketId } })
  ]);
  if (!request || request.ticketId !== parsed.ticketId || !request.body.startsWith(REQUEST_PREFIX) ||
    request.deliveryStatus !== "SENT" || !ticket || ticket.status !== "WAITING_FOR_CUSTOMER") return null;
  const latest = await prisma.supportMessage.findFirst({
    where: { ticketId: ticket.id, body: { startsWith: REQUEST_PREFIX } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true }
  });
  if (latest?.id !== request.id) return null;
  const answered = await prisma.supportMessage.findFirst({
    where: { ticketId: ticket.id, OR: [
      { body: { startsWith: `${CONFIRMED_PREFIX}${request.id}` } },
      { body: { startsWith: `${NEEDS_HELP_PREFIX}${request.id}` } }
    ] },
    select: { id: true }
  });
  return answered ? null : { ticketNumber: ticket.ticketNumber, subject: ticket.subject, requestId: request.id, ticketId: ticket.id };
}

export async function submitResolutionResponse(token: string, answer: "YES" | "NO", now = new Date()) {
  const inspected = await inspectResolutionToken(token, now);
  if (!inspected) {
    throw new HttpError(410, "This confirmation link has expired or was already used.", {
      code: "SUPPORT_CONFIRMATION_EXPIRED"
    });
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.supportTicket.updateMany({
      where: { id: inspected.ticketId, status: "WAITING_FOR_CUSTOMER" },
      data: {
        status: "OPEN",
        lastCustomerMessageAt: now,
        lastMessageAt: now
      }
    });
    if (updated.count !== 1) {
      throw new HttpError(409, "Support ticket status changed before confirmation.", { code: "SUPPORT_CONFIRMATION_STALE" });
    }
    // The transition to OPEN consumes the token; staff can finalize only after a YES audit entry.
    await tx.supportMessage.create({
      data: {
        ticketId: inspected.ticketId,
        senderType: "SYSTEM",
        channel: "SYSTEM",
        senderName: "Ysabelle Store Customer Confirmation",
        body: `${answer === "YES" ? CONFIRMED_PREFIX : NEEDS_HELP_PREFIX}${inspected.requestId}`,
        deliveryStatus: "NOT_APPLICABLE"
      }
    });
    return { ticketNumber: inspected.ticketNumber, answer };
  });
}

export async function hasCustomerResolutionConfirmation(ticketId: string) {
  const request = await prisma.supportMessage.findFirst({
    where: { ticketId, body: { startsWith: REQUEST_PREFIX } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true }
  });
  if (!request) return false;
  const [confirmation, ticket] = await Promise.all([
    prisma.supportMessage.findFirst({
      where: { ticketId, body: { startsWith: `${CONFIRMED_PREFIX}${request.id}` } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true }
    }),
    prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { lastStaffMessageAt: true }
    })
  ]);
  return Boolean(
    confirmation &&
    ticket &&
    (!ticket.lastStaffMessageAt || confirmation.createdAt >= ticket.lastStaffMessageAt)
  );
}
