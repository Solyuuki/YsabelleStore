import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_REQUEST_TIMEOUT_MS = 15_000;
const GMAIL_SYNC_INTERVAL_MS = 60_000;
const GMAIL_SYNC_PAGE_SIZE = 50;
const GMAIL_SYNC_MAX_MESSAGES = 200;
const GMAIL_SYNC_QUERY_DAYS = 30;
const GMAIL_ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;
const SUPPORT_EMAIL_BODY_MAX_LENGTH = 5_000;
const DELIVERY_ERROR_MESSAGE = "Gmail delivery failed. Retry is available.";
const TICKET_REFERENCE_PATTERN = /\bYS-CS-\d{6}\b/i;

const SUPPORT_LOGO_CONTENT_ID = "ysabelle-support-logo";
const SUPPORT_LOGO_FILENAME = "ysabelle-support-logo.gif";
export const SUPPORT_AUTOMATION_SENDER_NAME = "Ysabelle Store Auto Acknowledgement";

function loadSupportLogoBytes() {
  const directories = [
    path.resolve(process.cwd(), "backend", "assets", "email"),
    path.resolve(process.cwd(), "assets", "email")
  ];

  for (const directory of directories) {
    try {
      return readFileSync(path.join(directory, SUPPORT_LOGO_FILENAME));
    } catch {
      // The repository stores the optimized GIF as base64 text parts so GitHub text tooling can
      // carry the binary asset without changing its bytes at runtime.
    }

    try {
      const parts = readdirSync(directory)
        .filter((name) => /^ysabelle-support-logo\.gif\.b64\.part\d+$/.test(name))
        .sort((left, right) => left.localeCompare(right));
      if (parts.length > 0) {
        const encoded = parts
          .map((name) => readFileSync(path.join(directory, name), "utf8").trim())
          .join("");
        const decoded = Buffer.from(encoded, "base64");
        if (decoded.length > 0) return decoded;
      }
    } catch {
      // Try the next supported runtime location.
    }
  }

  return undefined;
}

let syncInFlight: Promise<SupportGmailSyncResult> | null = null;
let syncWorkerTimer: NodeJS.Timeout | null = null;

export type SupportGmailConfiguration = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  supportEmail: string;
  fromName: string;
  fetchImpl?: typeof fetch;
  logoBytes?: Buffer;
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
  kind?: "ACKNOWLEDGEMENT" | "STAFF_REPLY";
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

let runtimeGmailClient: SupportGmailClient | null = null;

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
    fromName,
    logoBytes: loadSupportLogoBytes()
  };
}

function isAutomatedTestRuntime() {
  return env.NODE_ENV === "test" || Boolean(process.env.NODE_TEST_CONTEXT);
}

export function isSupportGmailConfigured() {
  return Boolean(runtimeConfiguration());
}

export function isSupportLocalReplyFallbackAllowed() {
  return isAutomatedTestRuntime();
}

export function getSupportGmailStatus() {
  const configuration = runtimeConfiguration();
  return {
    configured: Boolean(configuration),
    mailbox: configuration?.supportEmail ?? null
  };
}

export function isSupportGmailDeliveryEnabled() {
  return isSupportGmailConfigured() && !isAutomatedTestRuntime();
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

function wrapBase64(value: string | Buffer) {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
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

function normalizeInboundMessageBody(value: string) {
  const normalized = value.trim();
  if (normalized.length <= SUPPORT_EMAIL_BODY_MAX_LENGTH) return normalized;

  return `${normalized.slice(0, SUPPORT_EMAIL_BODY_MAX_LENGTH - 1).trimEnd()}…`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function supportSignatureHtml(configuration: SupportGmailConfiguration) {
  const logo = configuration.logoBytes
    ? `<td style="width:84px;padding:0 16px 0 0;vertical-align:middle">
        <img src="cid:${SUPPORT_LOGO_CONTENT_ID}" width="64" height="64" alt="Ysabelle Store" style="display:block;width:64px;height:64px;border:0;border-radius:14px" />
      </td>`
    : "";

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #e8e4ff;padding-top:18px">
    <tr>
      ${logo}
      <td style="vertical-align:middle;font-family:Arial,sans-serif">
        <div style="font-size:13px;line-height:1.5;color:#77728c">Best regards,</div>
        <div style="margin-top:3px;font-size:16px;line-height:1.4;font-weight:700;color:#201b46">Ysabelle Store Customer Support</div>
        <div style="margin-top:4px;font-size:12px;line-height:1.5;color:#6d6785">${escapeHtml(configuration.supportEmail)}</div>
      </td>
    </tr>
  </table>`;
}

function buildRawSupportEmail(
  configuration: SupportGmailConfiguration,
  input: SupportGmailSendInput,
  replyMessageId: string | null
) {
  const subject =
    input.kind === "ACKNOWLEDGEMENT"
      ? `[${sanitizeHeaderValue(input.ticketNumber)}] We received your support request`
      : `[${sanitizeHeaderValue(input.ticketNumber)}] ${sanitizeHeaderValue(input.subject)}`;
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

  if (input.kind === "ACKNOWLEDGEMENT") {
    headers.push("Auto-Submitted: auto-replied");
  }

  if (replyMessageId) {
    headers.push(`In-Reply-To: ${sanitizeHeaderValue(replyMessageId)}`);
    headers.push(`References: ${sanitizeHeaderValue(replyMessageId)}`);
  }

  const text = [
    input.body.trim(),
    "",
    "Best regards,",
    "Ysabelle Store Customer Support",
    configuration.supportEmail,
    `Ticket: ${input.ticketNumber}`
  ].join("\n");

  const paragraphs = input.body
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#49445f">${escapeHtml(paragraph).replaceAll(
          "\n",
          "<br />"
        )}</p>`
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f7f7ff;font-family:Arial,sans-serif;color:#17162b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;padding:28px 14px;background:#f7f7ff">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e8e4ff;border-radius:22px">
            <tr>
              <td style="padding:30px">
                <div style="font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#6757d9">Ysabelle Store</div>
                <h1 style="margin:10px 0 18px;font-size:22px;line-height:1.3;color:#18152f">${input.kind === "ACKNOWLEDGEMENT" ? "Support request received" : "Customer support reply"}</h1>
                ${paragraphs}
                <div style="margin-top:18px;padding:12px 14px;border:1px solid #e8e4ff;border-radius:12px;background:#faf9ff;font-size:12px;line-height:1.6;color:#6d6785">
                  Ticket reference: <strong style="color:#332b72">${escapeHtml(input.ticketNumber)}</strong>
                </div>
                ${supportSignatureHtml(configuration)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const alternativeBoundary = `ys-alt-${Date.now().toString(36)}`;
  const relatedBoundary = `ys-related-${Math.random().toString(36).slice(2)}`;
  const alternative = [
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(text),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(html),
    `--${alternativeBoundary}--`,
    ""
  ];

  const related = configuration.logoBytes
    ? [
        ...alternative,
        `--${relatedBoundary}`,
        `Content-Type: image/gif; name="${SUPPORT_LOGO_FILENAME}"`,
        "Content-Transfer-Encoding: base64",
        `Content-ID: <${SUPPORT_LOGO_CONTENT_ID}>`,
        `Content-Disposition: inline; filename="${SUPPORT_LOGO_FILENAME}"`,
        "",
        wrapBase64(configuration.logoBytes),
        `--${relatedBoundary}--`,
        ""
      ]
    : [...alternative, `--${relatedBoundary}--`, ""];

  return [
    ...headers,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    "",
    ...related
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
  let cachedAccessToken: { token: string; expiresAt: number } | null = null;
  let accessTokenRefresh: Promise<string> | null = null;

  async function refreshAccessToken() {
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

    const payload = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
      throw new Error("Support Gmail authentication failed.");
    }

    const expiresInSeconds =
      typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
        ? Math.max(60, Math.trunc(payload.expires_in))
        : 3_600;
    cachedAccessToken = {
      token: payload.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1_000
    };
    return cachedAccessToken.token;
  }

  async function accessToken() {
    if (
      cachedAccessToken &&
      cachedAccessToken.expiresAt - GMAIL_ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now()
    ) {
      return cachedAccessToken.token;
    }

    if (accessTokenRefresh) return accessTokenRefresh;

    const refresh = refreshAccessToken();
    accessTokenRefresh = refresh;
    try {
      return await refresh;
    } finally {
      if (accessTokenRefresh === refresh) accessTokenRefresh = null;
    }
  }

  async function gmailRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    async function requestWithToken(token: string) {
      try {
        return await configuration.fetchImpl(`${GMAIL_API_BASE}${path}`, {
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
    }

    let token = await accessToken();
    let response = await requestWithToken(token);

    if (response.status === 401) {
      cachedAccessToken = null;
      token = await accessToken();
      response = await requestWithToken(token);
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
    const messages: GmailMessageReference[] = [];
    const seenMessageIds = new Set<string>();
    let pageToken: string | undefined;

    while (messages.length < GMAIL_SYNC_MAX_MESSAGES) {
      const params = new URLSearchParams({
        labelIds: "INBOX",
        maxResults: String(GMAIL_SYNC_PAGE_SIZE),
        q: `newer_than:${GMAIL_SYNC_QUERY_DAYS}d -from:${configuration.supportEmail}`
      });
      if (pageToken) params.set("pageToken", pageToken);

      const payload = await gmailRequest<{
        messages?: Array<{ id?: string; threadId?: string }>;
        nextPageToken?: unknown;
      }>(`/messages?${params.toString()}`);

      for (const message of payload.messages ?? []) {
        if (!message.id || seenMessageIds.has(message.id)) continue;
        seenMessageIds.add(message.id);
        messages.push({ id: message.id, threadId: message.threadId });
        if (messages.length >= GMAIL_SYNC_MAX_MESSAGES) break;
      }

      pageToken =
        typeof payload.nextPageToken === "string" && payload.nextPageToken.trim()
          ? payload.nextPageToken
          : undefined;
      if (!pageToken) break;
    }

    return messages;
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
  if (runtimeGmailClient) return runtimeGmailClient;

  const configuration = runtimeConfiguration();
  if (!configuration) throw supportGmailNotConfigured();

  runtimeGmailClient = createSupportGmailClient(configuration);
  return runtimeGmailClient;
}

type SupportEmailDeliveryOptions = {
  kind: "ACKNOWLEDGEMENT" | "STAFF_REPLY";
  transitionTicketStatus: boolean;
};

async function deliverSupportMessageEmail(
  messageId: string,
  options: SupportEmailDeliveryOptions,
  client: SupportGmailClient = runtimeClient()
) {
  const message = await prisma.supportMessage.findUnique({
    select: {
      id: true,
      senderType: true,
      senderName: true,
      body: true,
      ticketId: true,
      deliveryStatus: true,
      gmailMessageId: true,
      gmailThreadId: true,
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

  const expectedSender =
    options.kind === "ACKNOWLEDGEMENT"
      ? message?.senderType === "SYSTEM" && message.senderName === SUPPORT_AUTOMATION_SENDER_NAME
      : message?.senderType === "STAFF";
  if (!message || !expectedSender) {
    throw new HttpError(404, "Support message was not found.", {
      code: "SUPPORT_MESSAGE_NOT_FOUND"
    });
  }

  if (message.deliveryStatus === "SENT") {
    return {
      status: "SENT" as const,
      gmailMessageId: message.gmailMessageId,
      gmailThreadId: message.gmailThreadId
    };
  }

  if (message.deliveryStatus !== "PENDING") {
    throw new HttpError(409, "Support email is not pending delivery.", {
      code: "SUPPORT_EMAIL_NOT_PENDING"
    });
  }

  const previousGmailMessage =
    options.kind === "STAFF_REPLY"
      ? await prisma.supportMessage.findFirst({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { gmailMessageId: true },
          where: {
            ticketId: message.ticketId,
            id: { not: message.id },
            gmailMessageId: { not: null }
          }
        })
      : null;

  let sent: SupportGmailSendResult;
  try {
    sent = await client.sendSupportReply({
      to: message.ticket.customerEmail,
      ticketNumber: message.ticket.ticketNumber,
      subject: message.ticket.subject,
      body: message.body,
      threadId: message.ticket.gmailThreadId,
      replyToGmailMessageId: previousGmailMessage?.gmailMessageId ?? null,
      kind: options.kind
    });
  } catch {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.supportMessage.update({
        data: {
          channel: "EMAIL",
          deliveryStatus: "FAILED",
          deliveryError: DELIVERY_ERROR_MESSAGE,
          emailSentAt: null
        },
        where: { id: message.id }
      })
    ];

    if (options.transitionTicketStatus) {
      operations.push(
        prisma.supportTicket.updateMany({
          data: {
            status: "OPEN",
            resolvedAt: null,
            closedAt: null
          },
          where: {
            id: message.ticketId,
            status: { not: "CLOSED" }
          }
        })
      );
    }

    await prisma.$transaction(operations);
    return { status: "FAILED" as const, gmailMessageId: null, gmailThreadId: null };
  }

  const sentAt = new Date();
  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.supportMessage.update({
      data: {
        channel: "EMAIL",
        deliveryStatus: "SENT",
        deliveryError: null,
        gmailMessageId: sent.id,
        gmailThreadId: sent.threadId,
        emailSentAt: sentAt
      },
      where: {
        id: message.id,
        deliveryStatus: "PENDING"
      }
    }),
    prisma.supportTicket.update({
      data: { gmailThreadId: sent.threadId },
      where: { id: message.ticketId }
    })
  ];

  if (options.transitionTicketStatus) {
    operations.push(
      prisma.supportTicket.updateMany({
        data: {
          status: "WAITING_FOR_CUSTOMER",
          resolvedAt: null,
          closedAt: null
        },
        where: {
          id: message.ticketId,
          status: { not: "CLOSED" }
        }
      })
    );
  }

  await prisma.$transaction(operations);
  return { status: "SENT" as const, gmailMessageId: sent.id, gmailThreadId: sent.threadId };
}

export async function deliverStaffSupportMessageEmail(
  messageId: string,
  client: SupportGmailClient = runtimeClient()
) {
  return deliverSupportMessageEmail(
    messageId,
    { kind: "STAFF_REPLY", transitionTicketStatus: true },
    client
  );
}

export async function deliverAutomatedSupportAcknowledgementEmail(
  messageId: string,
  client: SupportGmailClient = runtimeClient()
) {
  return deliverSupportMessageEmail(
    messageId,
    { kind: "ACKNOWLEDGEMENT", transitionTicketStatus: false },
    client
  );
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
    const decodedBody = decodeMessageBody(message.payload) ?? message.snippet?.trim() ?? "";
    const body = normalizeInboundMessageBody(decodedBody);
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
