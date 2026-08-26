import { Router } from "express";

import {
  changeCustomerPasswordController,
  claimCustomerUsernameController,
  listCustomerOrdersController,
  listCustomerSessionsController,
  revokeOtherCustomerSessionsController,
  updateCustomerProfileController
} from "../controllers/customerAccountController.js";
import { createAuthRateLimit, derivePrivateRateLimitKey } from "../middleware/authRateLimit.js";
import {
  getAuthenticatedCustomer,
  requireCustomerAuth
} from "../middleware/customerAuthMiddleware.js";
import {
  disableSensitiveResponseCaching,
  requireAllowedCustomerAuthOrigin
} from "../middleware/customerAuthSecurity.js";
import { AUTH_RATE_LIMITS } from "../security/security.constants.js";
import { normalizeCustomerUsername } from "../utils/customerIdentity.js";

export const customerAccountRouter = Router();

function stringFieldFromBody(body: unknown, field: string): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

const customerSensitiveIpRateLimit = createAuthRateLimit(
  AUTH_RATE_LIMITS.customerAccountSensitiveIp
);
const customerSensitiveAccountRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerAccountSensitiveAccount,
  keyResolver(request) {
    const customer = getAuthenticatedCustomer(request);
    return customer
      ? derivePrivateRateLimitKey(
          AUTH_RATE_LIMITS.customerAccountSensitiveAccount.scope,
          customer.id
        )
      : null;
  }
});
const customerUsernameClaimTargetRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerUsernameClaimTarget,
  keyResolver(request) {
    const rawUsername = stringFieldFromBody(request.body, "username");
    if (!rawUsername) return null;

    const username = normalizeCustomerUsername(rawUsername);
    return username
      ? derivePrivateRateLimitKey(AUTH_RATE_LIMITS.customerUsernameClaimTarget.scope, username)
      : null;
  }
});

const sensitiveMutationMiddleware = [
  requireAllowedCustomerAuthOrigin,
  requireCustomerAuth,
  customerSensitiveIpRateLimit,
  customerSensitiveAccountRateLimit
] as const;

customerAccountRouter.use(disableSensitiveResponseCaching);
customerAccountRouter.get("/orders", requireCustomerAuth, listCustomerOrdersController);
customerAccountRouter.patch(
  "/profile",
  requireAllowedCustomerAuthOrigin,
  requireCustomerAuth,
  updateCustomerProfileController
);
customerAccountRouter.post(
  "/username/claim",
  ...sensitiveMutationMiddleware,
  customerUsernameClaimTargetRateLimit,
  claimCustomerUsernameController
);
customerAccountRouter.post(
  "/password/change",
  ...sensitiveMutationMiddleware,
  changeCustomerPasswordController
);
customerAccountRouter.get("/sessions", requireCustomerAuth, listCustomerSessionsController);
customerAccountRouter.post(
  "/sessions/revoke-others",
  ...sensitiveMutationMiddleware,
  revokeOtherCustomerSessionsController
);
