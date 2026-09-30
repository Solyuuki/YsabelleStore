import type { Request, RequestHandler } from "express";

import { getAuthenticatedUser } from "../middleware/authMiddleware.js";
import {
  getStaffSupportTicket,
  listStaffSupportTickets,
  replyToStaffSupportTicket,
  updateStaffSupportTicketStatus
} from "../services/staffSupportService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { parseOrThrow } from "../utils/requestValidation.js";
import {
  supportTicketIdParamsSchema,
  supportTicketListQuerySchema,
  supportTicketReplySchema,
  supportTicketStatusUpdateSchema
} from "../validators/customerSupport.validators.js";

function requireInternalUser(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    throw new HttpError(401, "Authentication token is required.", {
      code: "AUTH_TOKEN_REQUIRED"
    });
  }
  return user;
}

export const listStaffSupportTicketsController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const query = parseOrThrow(supportTicketListQuerySchema, request.query, {
      message: "Support ticket query is invalid.",
      code: "INVALID_SUPPORT_TICKET_QUERY"
    });
    const result = await listStaffSupportTickets(query);
    response.json(createSuccessResponse("Support tickets loaded.", result.items, result.meta));
  } catch (error) {
    next(error);
  }
};

export const getStaffSupportTicketController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const params = parseOrThrow(supportTicketIdParamsSchema, request.params, {
      message: "Support ticket id is invalid.",
      code: "INVALID_SUPPORT_TICKET_ID"
    });
    const ticket = await getStaffSupportTicket(params.ticketId);
    response.json(createSuccessResponse("Support ticket loaded.", ticket));
  } catch (error) {
    next(error);
  }
};

export const replyToStaffSupportTicketController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const actor = requireInternalUser(request);
    const params = parseOrThrow(supportTicketIdParamsSchema, request.params, {
      message: "Support ticket id is invalid.",
      code: "INVALID_SUPPORT_TICKET_ID"
    });
    const input = parseOrThrow(supportTicketReplySchema, request.body, {
      message: "Support ticket reply is invalid.",
      code: "INVALID_SUPPORT_TICKET_REPLY"
    });
    const ticket = await replyToStaffSupportTicket(params.ticketId, input, actor);
    response.json(createSuccessResponse("Support reply saved.", ticket));
  } catch (error) {
    next(error);
  }
};

export const updateStaffSupportTicketStatusController: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const actor = requireInternalUser(request);
    const params = parseOrThrow(supportTicketIdParamsSchema, request.params, {
      message: "Support ticket id is invalid.",
      code: "INVALID_SUPPORT_TICKET_ID"
    });
    const input = parseOrThrow(supportTicketStatusUpdateSchema, request.body, {
      message: "Support ticket status request is invalid.",
      code: "INVALID_SUPPORT_TICKET_STATUS_REQUEST"
    });
    const ticket = await updateStaffSupportTicketStatus(params.ticketId, input, actor);
    response.json(createSuccessResponse("Support ticket status updated.", ticket));
  } catch (error) {
    next(error);
  }
};
