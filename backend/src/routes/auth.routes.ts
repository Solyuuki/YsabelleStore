import { Router } from "express";

import { getCurrentUser, login, logout } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.post("/logout", logout);
