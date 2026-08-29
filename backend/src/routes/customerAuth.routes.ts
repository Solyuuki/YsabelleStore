import { Router } from "express";

import {
  getCurrentCustomer,
  issueCustomerRegistrationIntent,
  loginCustomerAccount,
  logoutCustomerAccount,
  registerCustomerAccount,
  requestCustomerPasswordRecoveryAccount,
  resetCustomerPasswordAccount,
  verifyCustomerPasswordRecoveryAccount
} from "../controllers/customerAuthController.js";
import {
  completeCustomerSocialAuth,
  completeCustomerSocialLinkAccount,
  redeemCustomerElectronSocialAuth,
  startCustomerElectronSocialAuth,
  startCustomerSocialAuth
} from "../controllers/customerSocialAuthController.js";
import { createAuthRateLimit, derivePrivateRateLimitKey } from "../middleware/authRateLimit.js";
import { requireCustomerAuth } from "../middleware/customerAuthMiddleware.js";
import {
  disableSensitiveResponseCaching,
  requireAllowedCustomerAuthOrigin
} from "../middleware/customerAuthSecurity.js";
import { AUTH_RATE_LIMITS } from "../security/security.constants.js";
import {
  classifyCustomerLoginIdentifier,
  normalizeCustomerEmail,
  normalizeCustomerUsername,
  normalizePhilippineMobile
} from "../utils/customerIdentity.js";

export const customerAuthRouter = Router();

function stringFieldFromBody(body: unknown, field: string): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function privateIdentityKey(scope: string, kind: string, normalized: string): string {
  return derivePrivateRateLimitKey(scope, `${kind}:${normalized}`);
}

const customerRegisterRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerRegister);
const customerRegisterUsernameRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerRegisterIdentity,
  keyResolver(request) {
    const rawUsername = stringFieldFromBody(request.body, "username");
    if (!rawUsername) return null;

    const username = normalizeCustomerUsername(rawUsername);
    return username
      ? privateIdentityKey(AUTH_RATE_LIMITS.customerRegisterIdentity.scope, "username", username)
      : null;
  }
});
const customerRegisterEmailRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerRegisterIdentity,
  keyResolver(request) {
    const rawEmail = stringFieldFromBody(request.body, "email");
    if (!rawEmail) return null;

    const email = normalizeCustomerEmail(rawEmail);
    return email
      ? privateIdentityKey(AUTH_RATE_LIMITS.customerRegisterIdentity.scope, "email", email)
      : null;
  }
});
const customerRegisterMobileRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerRegisterIdentity,
  keyResolver(request) {
    const rawPhone = stringFieldFromBody(request.body, "phone");
    if (!rawPhone) return null;

    const phone = normalizePhilippineMobile(rawPhone);
    return phone
      ? privateIdentityKey(AUTH_RATE_LIMITS.customerRegisterIdentity.scope, "phone", phone)
      : null;
  }
});
const customerLoginRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerLogin);
const customerLoginIdentifierRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerLoginIdentifier,
  keyResolver(request) {
    const rawIdentifier = stringFieldFromBody(request.body, "identifier");
    if (!rawIdentifier) return null;

    const identity = classifyCustomerLoginIdentifier(rawIdentifier);
    return identity
      ? privateIdentityKey(
          AUTH_RATE_LIMITS.customerLoginIdentifier.scope,
          identity.kind,
          identity.normalized
        )
      : null;
  }
});
const customerRecoveryRequestRateLimit = createAuthRateLimit(
  AUTH_RATE_LIMITS.customerRecoveryRequest
);
const customerRecoveryIdentifierRateLimit = createAuthRateLimit({
  ...AUTH_RATE_LIMITS.customerRecoveryIdentifier,
  keyResolver(request) {
    const rawIdentifier = stringFieldFromBody(request.body, "identifier");
    if (!rawIdentifier) return null;

    const identity = classifyCustomerLoginIdentifier(rawIdentifier);
    return identity
      ? privateIdentityKey(
          AUTH_RATE_LIMITS.customerRecoveryIdentifier.scope,
          identity.kind,
          identity.normalized
        )
      : null;
  }
});
const customerRecoveryVerifyRateLimit = createAuthRateLimit(
  AUTH_RATE_LIMITS.customerRecoveryVerify
);
const customerRecoveryResetRateLimit = createAuthRateLimit(AUTH_RATE_LIMITS.customerRecoveryReset);

customerAuthRouter.use(disableSensitiveResponseCaching);

customerAuthRouter.get(
  "/registration-intent",
  requireAllowedCustomerAuthOrigin,
  issueCustomerRegistrationIntent
);
customerAuthRouter.post(
  "/register",
  requireAllowedCustomerAuthOrigin,
  customerRegisterRateLimit,
  customerRegisterUsernameRateLimit,
  customerRegisterEmailRateLimit,
  customerRegisterMobileRateLimit,
  registerCustomerAccount
);
customerAuthRouter.post(
  "/login",
  requireAllowedCustomerAuthOrigin,
  customerLoginRateLimit,
  customerLoginIdentifierRateLimit,
  loginCustomerAccount
);
customerAuthRouter.post(
  "/recovery/request",
  requireAllowedCustomerAuthOrigin,
  customerRecoveryRequestRateLimit,
  customerRecoveryIdentifierRateLimit,
  requestCustomerPasswordRecoveryAccount
);
customerAuthRouter.post(
  "/recovery/verify",
  requireAllowedCustomerAuthOrigin,
  customerRecoveryVerifyRateLimit,
  verifyCustomerPasswordRecoveryAccount
);
customerAuthRouter.post(
  "/recovery/reset",
  requireAllowedCustomerAuthOrigin,
  customerRecoveryResetRateLimit,
  resetCustomerPasswordAccount
);

customerAuthRouter.get(
  "/social/:provider/start",
  requireAllowedCustomerAuthOrigin,
  startCustomerSocialAuth
);
customerAuthRouter.get("/social/:provider/callback", completeCustomerSocialAuth);
customerAuthRouter.post(
  "/social/link/complete",
  requireAllowedCustomerAuthOrigin,
  requireCustomerAuth,
  completeCustomerSocialLinkAccount
);
customerAuthRouter.post(
  "/social/electron/start",
  requireAllowedCustomerAuthOrigin,
  startCustomerElectronSocialAuth
);
customerAuthRouter.post(
  "/social/electron/redeem",
  requireAllowedCustomerAuthOrigin,
  redeemCustomerElectronSocialAuth
);

customerAuthRouter.get("/me", requireCustomerAuth, getCurrentCustomer);
customerAuthRouter.post("/logout", requireAllowedCustomerAuthOrigin, logoutCustomerAccount);
