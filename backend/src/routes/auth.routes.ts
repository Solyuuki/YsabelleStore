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
import { createAuthRateLimit } from "../middleware/authRateLimit.js";
import { AUTH_RATE_LIMITS } from "../security/security.constants.js";

export const authRouter = Router();

const internalLoginRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.internalLogin);

authRouter.post("/login", internalLoginRateLimit, login);
authRouter.post("/register", requireAuth, register);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post("/trusted-device/session", createTrustedDeviceSession);
authRouter.post("/trusted-device/revoke", revokeTrustedDeviceSession);
authRouter.post("/logout", logout);
