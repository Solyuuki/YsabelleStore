import { Router } from "express";

import {
  getStaffSupportTicketController,
  listStaffSupportTicketsController,
  replyToStaffSupportTicketController,
  updateStaffSupportTicketStatusController
} from "../controllers/staffSupportController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

export const staffSupportRouter = Router();

staffSupportRouter.use(requireAuth, requireRole("OWNER", "STAFF"));
staffSupportRouter.get("/tickets", listStaffSupportTicketsController);
staffSupportRouter.get("/tickets/:ticketId", getStaffSupportTicketController);
staffSupportRouter.post("/tickets/:ticketId/replies", replyToStaffSupportTicketController);
staffSupportRouter.patch("/tickets/:ticketId/status", updateStaffSupportTicketStatusController);
