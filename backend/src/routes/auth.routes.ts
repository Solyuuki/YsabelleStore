import { Router } from "express";

import {
  createTrustedDeviceSession,
  getCurrentUser,
  login,
  logout,
  register,
  revokeTrustedDeviceSession
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/register", requireAuth, register);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post("/trusted-device/session", createTrustedDeviceSession);
authRouter.post("/trusted-device/revoke", revokeTrustedDeviceSession);
authRouter.post("/logout", logout);
