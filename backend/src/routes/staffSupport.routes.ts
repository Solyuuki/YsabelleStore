import { Router } from "express";

import {
  getStaffSupportTicketController,
  getSupportGmailStatusController,
  listStaffSupportTicketsController,
  replyToStaffSupportTicketController,
  retryStaffSupportEmailController,
  syncSupportGmailController,
  updateStaffSupportTicketStatusController,
  requestSupportResolutionController
} from "../controllers/staffSupportController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const staffSupportRouter = Router();

staffSupportRouter.use(requireAuth, requireRole("OWNER", "STAFF"));
staffSupportRouter.get("/gmail/status", getSupportGmailStatusController);
staffSupportRouter.post("/gmail/sync", syncSupportGmailController);
staffSupportRouter.get("/tickets", listStaffSupportTicketsController);
staffSupportRouter.get("/tickets/:ticketId", getStaffSupportTicketController);
staffSupportRouter.post("/tickets/:ticketId/replies", replyToStaffSupportTicketController);
staffSupportRouter.post(
  "/tickets/:ticketId/messages/:messageId/retry-email",
  retryStaffSupportEmailController
);
staffSupportRouter.patch("/tickets/:ticketId/status", updateStaffSupportTicketStatusController);
staffSupportRouter.post("/tickets/:ticketId/request-resolution", requestSupportResolutionController);
