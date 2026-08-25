import { Router } from "express";

import {
  getCurrentCustomer,
  issueCustomerRegistrationIntent,
  loginCustomerAccount,
  logoutCustomerAccount,
  registerCustomerAccount
} from "../controllers/customerAuthController.js";
import {
  createAuthRateLimit,
  derivePrivateRateLimitKey
} from "../middleware/authRateLimit.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";
import { AUTH_RATE_LIMITS } from "../security/security.constants.js";

export const customerAuthRouter = Router();

function normalizedEmailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const email = (body as { email?: unknown }).email;
  if (typeof email !== "string") return null;

  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

const customerRegisterRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerRegister);
const customerRegisterIdentityRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerRegisterIdentity,
  keyResolver(request) {
    const email = normalizedEmailFromBody(request.body);
    return email
      ? derivePrivateRateLimitKey(AUTH_RATE_LIMITS.customerRegisterIdentity.scope, email)
      : null;
  }
});
const customerLoginRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerLogin);
const customerLoginIdentifierRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerLoginIdentifier,
  keyResolver(request) {
    const email = normalizedEmailFromBody(request.body);
    return email
      ? derivePrivateRateLimitKey(AUTH_RATE_LIMITS.customerLoginIdentifier.scope, email)
      : null;
  }
});

customerAuthRouter.get("/registration-intent", issueCustomerRegistrationIntent);
customerAuthRouter.post(
  "/register",
  customerRegisterRateLimit,
  customerRegisterIdentityRateLimit,
  registerCustomerAccount
);
customerAuthRouter.post(
  "/login",
  customerLoginRateLimit,
  customerLoginIdentifierRateLimit,
  loginCustomerAccount
);
customerAuthRouter.get("/me", requireCustomerAuth, getCurrentCustomer);
customerAuthRouter.post("/logout", logoutCustomerAccount);
