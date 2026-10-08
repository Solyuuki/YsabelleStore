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
  const buttons = token
    ? `<form action="/api/customer-support/resolution" method="post">
        ${tokenField}
        <div class="actions">
          ${selected !== "NO" ? '<button class="primary" name="answer" value="YES" type="submit">Yes, resolved</button>' : ""}
          ${selected !== "YES" ? '<button class="secondary" name="answer" value="NO" type="submit">No, I need more help</button>' : ""}
        </div>
      </form>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>${title} | Ysabelle Store</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;font:15px/1.6 Arial,Helvetica,sans-serif;color:#252044;background:radial-gradient(ellipse at 18% 12%,#e6eaff 0%,transparent 48%),radial-gradient(ellipse at 95% 84%,#f7eaff 0%,transparent 46%),#f9f9ff;display:flex;align-items:center;justify-content:center;padding:30px 18px}
    main{width:min(100%,520px);padding:36px;border:1px solid #e9e5ff;border-radius:22px;background:#fff;box-shadow:0 18px 60px rgba(46,36,106,.07)}
    .brand{color:#6552e8;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    h1{font-size:25px;line-height:1.25;letter-spacing:-.025em;margin:20px 0 12px;color:#1e1946}
    p{margin:0;color:#625f78;line-height:1.7}
    .actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
    button{font:600 14px Arial,sans-serif;cursor:pointer;padding:13px 19px;border-radius:11px;border:1px solid #e4e0fc;min-height:46px}
    .primary{color:#fff;background:#6354e9;border-color:#6354e9}
    .secondary{background:#f5f3ff;color:#403681}
    button:focus-visible{outline:3px solid #a79dfb;outline-offset:3px}
    footer{margin-top:28px;padding-top:18px;border-top:1px solid #f0edff;color:#85819b;font-size:12px}
    @media(max-width:440px){main{padding:26px 22px}.actions{flex-direction:column}button{width:100%}}
  </style></head><body><main><div class="brand">Ysabelle Store · Customer Care</div><h1>${title}</h1><p>${body}</p>${buttons}<footer>This secure confirmation can only be used once and expires after 72 hours.</footer></main></body></html>`;
}

export const viewSupportResolutionController: RequestHandler = async (request, response, next) => {
  try {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    const { inspectResolutionToken } = await import("../services/supportResolutionService.js");
    const result = await inspectResolutionToken(token);
    response.set("Cache-Control", "no-store");
    response.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
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
    response.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    response.set("Referrer-Policy", "no-referrer");
    response.type("html").send(resolutionHtml(
      "Response received",
      result.answer === "YES"
        ? "Your support ticket is now resolved. A final confirmation has been sent to your email."
        : "Thank you. Your ticket has been reopened for further assistance."
    ));
  } catch (error) { next(error); }
};
