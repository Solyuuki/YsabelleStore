export const SECURITY_HEADERS = {
  contentTypeOptions: "nosniff",
  frameOptions: "DENY",
  referrerPolicy: "no-referrer",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()",
  crossOriginResourcePolicy: "same-origin"
} as const;

export const SECURITY_LIMITS = {
  jsonBodyLimit: "1mb",
  plannedImportFileSizeMb: 10,
  plannedRateLimitWindowMinutes: 15,
  plannedRateLimitMaxRequests: 300
} as const;

export const FUTURE_AUTH_ROLES = {
  admin: "admin",
  user: "user"
} as const;

export const ALLOWED_IMPORT_EXTENSIONS = [".csv", ".xlsx"] as const;
