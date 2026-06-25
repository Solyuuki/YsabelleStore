import { env } from "../config/env.js";
import {
  ALLOWED_IMPORT_EXTENSIONS,
  FUTURE_AUTH_ROLES,
  SECURITY_HEADERS,
  SECURITY_LIMITS
} from "./security.constants.js";

export const securityConfig = {
  environment: env.NODE_ENV,
  headers: SECURITY_HEADERS,
  limits: SECURITY_LIMITS,
  futureAuth: {
    roles: FUTURE_AUTH_ROLES,
    tokenStrategy: "jwt_access_token",
    provider: "local_only"
  },
  imports: {
    allowedExtensions: ALLOWED_IMPORT_EXTENSIONS,
    previewBeforeCommit: true
  }
} as const;
