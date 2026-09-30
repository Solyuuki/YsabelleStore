import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_REQUEST_TIMEOUT_MS = 15_000;
const GMAIL_SYNC_INTERVAL_MS = 60_000;
const GMAIL_SYNC_MAX_RESULTS = 50;
const GMAIL_SYNC_QUERY_DAYS = 30;
const DELIVERY_ERROR_MESSAGE = "Gmail delivery failed. Retry is available.";
const TICKET_REFERENCE_PATTERN = /\bYS-CS-\d{6}\b/i;

let syncInFlight: Promise<SupportGmailSyncResult> | null = null;
let syncWorkerTimer: NodeJS.Timeout | null = null;

export type SupportGmailConfiguration = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  supportEmail: string;
  fromName: string;
  fetchImpl?: typeof fetch;
};

export type GmailMessageHeader = {
  name?: string;
  value?: string;
};

export type GmailMessagePart = {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
};

export type GmailApiMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart & {
    headers?: GmailMessageHeader[];
  };
};

type GmailMessageReference = {
  id: string;
  threadId?: string;
};

export type SupportGmailSendInput = {
  to: string;
  ticketNumber: string;
  subject: string;
  body: string;
  threadId?: string | null;
  replyToGmailMessageId?: string | null;
};

export type SupportGmailSendResult = {
  id: string;
  threadId: string;
};

export type SupportGmailSyncResult = {
  imported: number;
  skipped: number;
};

export type SupportGmailClient = {
  getMessage(messageId: string): Promise<GmailApiMessage>;
  listInboxMessages(): Promise<GmailMessageReference[]>;
  sendSupportReply(input: SupportGmailSendInput): Promise<SupportGmailSendResult>;
};

function runtimeConfiguration(): SupportGmailConfiguration | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_GMAIL_REFRESH_TOKEN?.trim();
  const supportEmail = env.CUSTOMER_SUPPORT_EMAIL?.trim().toLowerCase();
  const fromName = env.CUSTOMER_SUPPORT_FROM_NAME.trim();

  if (!clientId || !clientSecret || !refreshToken || !supportEmail) return null;

  return {
    clientId,
    clientSecret,
    refreshToken,
    supportEmail,
    fromName
  };
}

function isAutomatedTestRuntime() {
  return env.NODE_ENV === "test" || Boolean(process.env.NODE_TEST_CONTEXT);
}

export function getSupportGmailStatus() {
  const configuration = runtimeConfiguration();
  return {
    configured: Boolean(configuration),
    mailbox: configuration?.supportEmail ?? null
  };
}

export function isSupportGmailDeliveryEnabled() {
  return Boolean(runtimeConfiguration()) && !isAutomatedTestRuntime();
}

function supportGmailNotConfigured() {
  return new HttpError(503, "Support Gmail integration is not configured.", {
    code: "SUPPORT_GMAIL_NOT_CONFIGURED"
  });
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeaderText(value: string) {
  return `=?UTF-8?B?${Buffer.from(sanitizeHeaderValue(value), "utf8").toString("base64")}?=`;
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function wrapBase64(value: string) {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function headerValue(message: GmailApiMessage, name: string) {
  return (
    message.payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? null
  );
}

function extractEmailAddress(value: string | null) {
  if (!value) return null;
  const angleMatch = /<([^<>\s]+@[^<>\s]+)>/.exec(value);
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase();
  const plainMatch = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.exec(value);
  return plainMatch?.[0]?.trim().toLowerCase() ?? null;
}

function extractDisplayName(value: string | null, email: string) {
  if (!value) return email;
  const bracketIndex = value.indexOf("<");
  if (bracketIndex < 0) return email;
  const name = value
    .slice(0, bracketIndex)
    .replace(/^["']|["']$/g, "")
    .trim();
  return name || email;
}

function decodeMessageBody(part: GmailMessagePart | undefined): string | null {
  if (!part) return null;

  if (part.mimeType?.toLowerCase() === "text/plain" && part.body?.data) {
    const decoded = decodeBase64Url(part.body.data).trim();
    if (decoded) return decoded;
  }

  for (const child of part.parts ?? []) {
    const decoded = decodeMessageBody(child);
    if (decoded) return decoded;
  }

  if (part.mimeType?.toLowerCase() === "text/html" && part.body?.data) {
    const html = decodeBase64Url(part.body.data);
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text) return text;
  }

  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data).trim();
    if (decoded) return decoded;
  }

  return null;
}

function messageActivityAt(message: GmailApiMessage, fallback = new Date()) {
  const internalMillis = Number(message.internalDate);
  if (Number.isFinite(internalMillis) && internalMillis > 0) {
    return new Date(internalMillis);
  }

  const dateHeader = headerValue(message, "Date");
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return fallback;
}

function supportTicketNumberFromSubject(subject: string | null) {
  return subject?.match(TICKET_REFERENCE_PATTERN)?.[0]?.toUpperCase() ?? null;
}

function buildRawSupportEmail(
  configuration: SupportGmailConfiguration,
  input: SupportGmailSendInput,
  replyMessageId: string | null
) {
  const subject = `[${sanitizeHeaderValue(input.ticketNumber)}] ${sanitizeHeaderValue(input.subject)}`;
  const domain = configuration.supportEmail.split("@")[1] ?? "ysabellestore.local";
  const generatedMessageId = `<ys-support-${Date.now()}-${Math.random().toString(36).slice(2)}@${domain}>`;
  const headers = [
    `From: ${encodeHeaderText(configuration.fromName)} <${configuration.supportEmail}>`,
    `To: ${sanitizeHeaderValue(input.to)}`,
    `Subject: ${encodeHeaderText(subject)}`,
    `Reply-To: ${configuration.supportEmail}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${generatedMessageId}`
  ];

  if (replyMessageId) {
    headers.push(`In-Reply-To: ${sanitizeHeaderValue(replyMessageId)}`);
    headers.push(`References: ${sanitizeHeaderValue(replyMessageId)}`);
  }

  const text = [
    input.body.trim(),
    "",
    "— Ysabelle Store Customer Support",
    `Ticket: ${input.ticketNumber}`
  ].join("\n");

  return [
    ...headers,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(text),
    ""
  ].join("\r\n");
}

export function createSupportGmailClient(input: SupportGmailConfiguration): SupportGmailClient {
  const configuration = {
    ...input,
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    refreshToken: input.refreshToken.trim(),
    supportEmail: input.supportEmail.trim().toLowerCase(),
    fromName: input.fromName.trim(),
    fetchImpl: input.fetchImpl ?? fetch
  };

  async function accessToken() {
    let response: Response;
    try {
      response = await configuration.fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: configuration.clientId,
          client_secret: configuration.clientSecret,
          refresh_token: configuration.refreshToken,
          grant_type: "refresh_token"
        }),
        signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS)
      });
    } catch {
      throw new Error("Support Gmail authentication failed.");
    }

    if (!response.ok) throw new Error("Support Gmail authentication failed.");

    const payload = (await response.json()) as { access_token?: unknown };
    if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
      throw new Error("Support Gmail authentication failed.");
    }
    return payload.access_token;
  }

  async function gmailRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await accessToken();
    let response: Response;
    try {
      response = await configuration.fetchImpl(`${GMAIL_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...Object.fromEntries(new Headers(init.headers).entries())
        },
        signal: init.signal ?? AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS)
      });
    } catch {
      throw new Error("Support Gmail request failed.");
    }

    if (!response.ok) throw new Error("Support Gmail request failed.");
    return (await response.json()) as T;
  }

  async function getMessage(messageId: string) {
    return gmailRequest<GmailApiMessage>(`/messages/${encodeURIComponent(messageId)}?format=full`);
  }

  async function getRfcMessageId(messageId: string) {
    const message = await gmailRequest<GmailApiMessage>(
      `/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Message-ID`
    );
    return headerValue(message, "Message-ID");
  }

  async function listInboxMessages() {
    const params = new URLSearchParams({
      labelIds: "INBOX",
      maxResults: String(GMAIL_SYNC_MAX_RESULTS),
      q: `newer_than:${GMAIL_SYNC_QUERY_DAYS}d -from:${configuration.supportEmail}`
    });
    const payload = await gmailRequest<{
      messages?: Array<{ id?: string; threadId?: string }>;
    }>(`/messages?${params.toString()}`);

    return (payload.messages ?? [])
      .filter((message): message is { id: string; threadId?: string } => Boolean(message.id))
      .map((message) => ({ id: message.id, threadId: message.threadId }));
  }

  async function sendSupportReply(input: SupportGmailSendInput) {
    let replyMessageId: string | null = null;
    if (input.replyToGmailMessageId) {
      try {
        replyMessageId = await getRfcMessageId(input.replyToGmailMessageId);
      } catch {
        replyMessageId = null;
      }
    }

    const raw = buildRawSupportEmail(configuration, input, replyMessageId);
    const payload = await gmailRequest<{ id?: string; threadId?: string }>("/messages/send", {
      method: "POST",
      body: JSON.stringify({
        raw: encodeBase64Url(raw),
        ...(input.threadId ? { threadId: input.threadId } : {})
      })
    });

    if (!payload.id || !payload.threadId) {
      throw new Error("Support Gmail send returned an incomplete response.");
    }

    return { id: payload.id, threadId: payload.threadId };
  }

  return { getMessage, listInboxMessages, sendSupportReply };
}

function runtimeClient() {
  const configuration = runtimeConfiguration();
  if (!configuration) throw supportGmailNotConfigured();
  return createSupportGmailClient(configuration);
}

export async function deliverStaffSupportMessageEmail(messageId: string) {
  const configuration = runtimeConfiguration();
  if (!configuration) throw supportGmailNotConfigured();

  const message = await prisma.supportMessage.findUnique({
    select: {
      id: true,
      senderType: true,
      body: true,
      ticketId: true,
      ticket: {
        select: {
          ticketNumber: true,
          subject: true,
          customerEmail: true,
          gmailThreadId: true
        }
      }
    },
    where: { id: messageId }
  });

  if (!message || message.senderType !== "STAFF") {
    throw new HttpError(404, "Support message was not found.", {
      code: "SUPPORT_MESSAGE_NOT_FOUND"
    });
  }

  const previousGmailMessage = await prisma.supportMessage.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { gmailMessageId: true },
    where: {
      ticketId: message.ticketId,
      id: { not: message.id },
      gmailMessageId: { not: null }
    }
  });

  try {
    const sent = await createSupportGmailClient(configuration).sendSupportReply({
      to: message.ticket.customerEmail,
      ticketNumber: message.ticket.ticketNumber,
      subject: message.ticket.subject,
      body: message.body,
      threadId: message.ticket.gmailThreadId,
      replyToGmailMessageId: previousGmailMessage?.gmailMessageId ?? null
    });
    const sentAt = new Date();

    await prisma.$transaction([
      prisma.supportMessage.update({
        data: {
          channel: "EMAIL",
          deliveryStatus: "SENT",
          deliveryError: null,
          gmailMessageId: sent.id,
          gmailThreadId: sent.threadId,
          emailSentAt: sentAt
        },
        where: { id: message.id }
      }),
      prisma.supportTicket.update({
        data: { gmailThreadId: sent.threadId },
        where: { id: message.ticketId }
      })
    ]);

    return { status: "SENT" as const, gmailMessageId: sent.id, gmailThreadId: sent.threadId };
  } catch {
    await prisma.supportMessage.update({
      data: {
        channel: "EMAIL",
        deliveryStatus: "FAILED",
        deliveryError: DELIVERY_ERROR_MESSAGE,
        emailSentAt: null
      },
      where: { id: message.id }
    });

    return { status: "FAILED" as const, gmailMessageId: null, gmailThreadId: null };
  }
}

export async function syncSupportGmailInboxWithClient(
  client: SupportGmailClient,
  now = new Date()
): Promise<SupportGmailSyncResult> {
  const references = await client.listInboxMessages();
  let imported = 0;
  let skipped = 0;

  for (const reference of references) {
    const existing = await prisma.supportMessage.findUnique({
      select: { id: true },
      where: { gmailMessageId: reference.id }
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    let message: GmailApiMessage;
    try {
      message = await client.getMessage(reference.id);
    } catch {
      skipped += 1;
      continue;
    }

    const gmailMessageId = message.id ?? reference.id;
    const gmailThreadId = message.threadId ?? reference.threadId ?? null;
    const fromHeader = headerValue(message, "From");
    const senderEmail = extractEmailAddress(fromHeader);
    if (!senderEmail) {
      skipped += 1;
      continue;
    }

    let ticket = gmailThreadId
      ? await prisma.supportTicket.findUnique({
          where: { gmailThreadId }
        })
      : null;

    if (!ticket) {
      const ticketNumber = supportTicketNumberFromSubject(headerValue(message, "Subject"));
      if (ticketNumber) {
        ticket = await prisma.supportTicket.findUnique({
          where: { ticketNumber }
        });
      }
    }

    if (!ticket || ticket.customerEmail.trim().toLowerCase() !== senderEmail) {
      skipped += 1;
      continue;
    }

    const matchedTicket = ticket;
    const body = decodeMessageBody(message.payload) ?? message.snippet?.trim() ?? "";
    if (!body) {
      skipped += 1;
      continue;
    }

    const activityAt = messageActivityAt(message, now);
    const lastMessageAt =
      activityAt > matchedTicket.lastMessageAt ? activityAt : matchedTicket.lastMessageAt;
    const lastCustomerMessageAt =
      !matchedTicket.lastCustomerMessageAt || activityAt > matchedTicket.lastCustomerMessageAt
        ? activityAt
        : matchedTicket.lastCustomerMessageAt;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.supportMessage.create({
          data: {
            ticketId: matchedTicket.id,
            senderType: "CUSTOMER",
            channel: "EMAIL",
            senderName: extractDisplayName(fromHeader, senderEmail),
            senderEmail,
            body,
            gmailMessageId,
            gmailThreadId,
            deliveryStatus: "NOT_APPLICABLE",
            createdAt: activityAt
          }
        });

        await tx.supportTicket.update({
          data: {
            gmailThreadId: matchedTicket.gmailThreadId ?? gmailThreadId,
            status: "OPEN",
            lastMessageAt,
            lastCustomerMessageAt,
            resolvedAt: null,
            closedAt: null
          },
          where: { id: matchedTicket.id }
        });
      });
      imported += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return { imported, skipped };
}

export async function syncSupportGmailInbox() {
  if (syncInFlight) return await syncInFlight;

  const operation = syncSupportGmailInboxWithClient(runtimeClient());
  syncInFlight = operation;

  try {
    return await operation;
  } finally {
    if (syncInFlight === operation) syncInFlight = null;
  }
}

async function reconcileSupportGmailInbox() {
  try {
    const result = await syncSupportGmailInbox();
    if (result.imported > 0) {
      console.info(`[support-gmail] Imported ${result.imported} customer email reply/replies.`);
    }
  } catch {
    console.error("[support-gmail] Gmail synchronization failed.");
  }
}

export function startSupportGmailSyncWorker(intervalMs = GMAIL_SYNC_INTERVAL_MS) {
  if (syncWorkerTimer || !runtimeConfiguration() || isAutomatedTestRuntime()) return;

  const safeIntervalMs = Math.max(30_000, Math.trunc(intervalMs));
  void reconcileSupportGmailInbox();
  syncWorkerTimer = setInterval(() => {
    void reconcileSupportGmailInbox();
  }, safeIntervalMs);
  syncWorkerTimer.unref();

  console.info(`[support-gmail] Inbox synchronization started (interval=${safeIntervalMs}ms).`);
}

export function stopSupportGmailSyncWorker() {
  if (!syncWorkerTimer) return;
  clearInterval(syncWorkerTimer);
  syncWorkerTimer = null;
}
