import { Router } from "express";

import { getCurrentUser, login, logout, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const authRouter = Router();

authRouter.post("/login", login);
// TODO: Add owner-only protection when the register endpoint is moved fully behind user management.
authRouter.post("/register", register);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post("/logout", logout);
