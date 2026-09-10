export const SECURITY_HEADERS = {
  contentTypeOptions: "nosniff",
  frameOptions: "DENY",
  referrerPolicy: "no-referrer",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()",
  crossOriginResourcePolicy: "same-origin"
} as const;

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const AUTH_RATE_LIMITS = {
  internalLogin: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "internal-login"
  },
  customerLogin: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-login"
  },
  customerLoginIdentifier: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 5,
    scope: "customer-login-identifier"
  },
  customerRegister: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 5,
    scope: "customer-register"
  },
  customerRegisterIdentity: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 3,
    scope: "customer-register-identity"
  },
  customerEmailRegistrationRequest: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 30,
    scope: "customer-email-registration-request"
  },
  customerEmailRegistrationEmail: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 5,
    scope: "customer-email-registration-email"
  },
  customerEmailRegistrationVerify: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 50,
    scope: "customer-email-registration-verify"
  },
  customerEmailRegistrationVerifyEmail: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-email-registration-verify-email"
  },
  customerEmailAuthRequest: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 30,
    scope: "customer-email-auth-request"
  },
  customerEmailAuthEmail: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 5,
    scope: "customer-email-auth-email"
  },
  customerEmailAuthVerify: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 50,
    scope: "customer-email-auth-verify"
  },
  customerEmailAuthVerifyEmail: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-email-auth-verify-email"
  },
  customerMobileAuthRequest: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 30,
    scope: "customer-mobile-auth-request"
  },
  customerMobileAuthPhone: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 5,
    scope: "customer-mobile-auth-phone"
  },
  customerMobileAuthVerify: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 50,
    scope: "customer-mobile-auth-verify"
  },
  customerMobileAuthVerifyPhone: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-mobile-auth-verify-phone"
  },
  customerRecoveryRequest: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-recovery-request"
  },
  customerRecoveryIdentifier: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 3,
    scope: "customer-recovery-identifier"
  },
  customerRecoveryVerify: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-recovery-verify"
  },
  customerRecoveryReset: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 10,
    scope: "customer-recovery-reset"
  },
  customerAccountSensitiveIp: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 20,
    scope: "customer-account-sensitive-ip"
  },
  customerAccountSensitiveAccount: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 5,
    scope: "customer-account-sensitive-account"
  },
  customerUsernameClaimTarget: {
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: 3,
    scope: "customer-username-claim-target"
  }
} as const;

export const SECURITY_LIMITS = {
  jsonBodyLimit: "1mb",
  plannedImportFileSizeMb: 10,
  plannedRateLimitWindowMinutes: 15,
  plannedRateLimitMaxRequests: 300
} as const;

export const PRODUCT_IMAGE_UPLOAD_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxDecodedPixels: 24_000_000,
  maxDimensionPixels: 8_000,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
} as const;

export const FUTURE_AUTH_ROLES = {
  admin: "admin",
  user: "user"
} as const;

export const ALLOWED_IMPORT_EXTENSIONS = [".csv", ".xlsx"] as const;
