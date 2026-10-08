import type { RequestHandler } from "express";

import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import { createCustomerSupportTicket } from "../services/customerSupportService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import { customerSupportTicketCreateSchema } from "../validators/customerSupport.validators.js";

export const createCustomerSupportTicketController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const body = parseOrThrow(customerSupportTicketCreateSchema, request.body, {
      message: "Customer support request is invalid.",
      code: "INVALID_CUSTOMER_SUPPORT_REQUEST"
    });
    const ticket = await createCustomerSupportTicket(body, {
      customer: getAuthenticatedCustomer(request)
    });

    response.status(201).json(createSuccessResponse("Customer support request submitted.", ticket));
  } catch (error) {
    next(error);
  }
};

function resolutionHtml(title: string, body: string, token?: string, selected?: "YES" | "NO") {
  const tokenField = token ? `<input type="hidden" name="token" value="${token}" />` : "";
  const yesAction = selected !== "NO"
    ? '<button name="answer" value="YES" type="submit">Confirm: Yes, resolved</button>'
    : "";
  const noAction = selected !== "YES"
    ? '<button name="answer" value="NO" type="submit">Confirm: No, I need more help</button>'
    : "";
  const actions = token
    ? `<form action="/api/customer-support/resolution" method="post">
        ${tokenField}
        ${yesAction}${noAction}
      </form>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | Ysabelle Store</title><style>body{margin:0;background:#f7f7ff;color:#201b46;font:16px Arial,sans-serif;padding:40px 18px}main{max-width:480px;margin:10vh auto;background:#fff;border:1px solid #e8e4ff;border-radius:20px;padding:28px}h1{font-size:24px}p{line-height:1.6}button{padding:13px 18px;border:0;border-radius:10px;background:#6254df;color:#fff;cursor:pointer;margin:6px 8px 6px 0;font-weight:700}button[value="NO"]{background:#f1efff;color:#332b72}</style></head><body><main><h1>${title}</h1><p>${body}</p>${actions}</main></body></html>`;
}

export const viewSupportResolutionController: RequestHandler = async (request, response, next) => {
  try {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    const { inspectResolutionToken } = await import("../services/supportResolutionService.js");
    const result = await inspectResolutionToken(token);
    response.set("Cache-Control", "no-store");
    response.set("Referrer-Policy", "no-referrer");
    if (!result) {
      response.status(410).type("html").send(resolutionHtml("Link unavailable", "This confirmation link has expired or has already been used."));
      return;
    }
    const safeToken = token.replace(/[^A-Za-z0-9._-]/g, "");
    const selected = request.query.answer === "YES" || request.query.answer === "NO"
      ? request.query.answer
      : undefined;
    response.type("html").send(resolutionHtml(
      selected === "YES" ? "Confirm resolution" : selected === "NO" ? "Request more help" : "Resolution confirmation",
      selected === "YES"
        ? "Please confirm that your support concern has been resolved."
        : selected === "NO"
          ? "Please confirm that you still need assistance. Your support ticket will reopen."
          : "Has your Ysabelle Store support concern been resolved?",
      safeToken,
      selected
    ));
  } catch (error) { next(error); }
};

export const submitSupportResolutionController: RequestHandler = async (request, response, next) => {
  try {
    const token = typeof request.body?.token === "string" ? request.body.token : "";
    const answer = request.body?.answer;
    if (answer !== "YES" && answer !== "NO") {
      response.status(400).type("html").send(resolutionHtml("Invalid response", "Choose Yes or No to continue."));
      return;
    }
    const { submitResolutionResponse } = await import("../services/supportResolutionService.js");
    const result = await submitResolutionResponse(token, answer);
    response.set("Cache-Control", "no-store");
    response.set("Referrer-Policy", "no-referrer");
    response.type("html").send(resolutionHtml(
      "Response received",
      result.answer === "YES"
        ? "Thank you. Our support staff will finalize your resolution."
        : "Thank you. Your ticket has been reopened for further assistance."
    ));
  } catch (error) { next(error); }
};
