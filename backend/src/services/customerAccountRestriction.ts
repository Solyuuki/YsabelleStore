import type { CustomerAccount } from "@prisma/client";

import { HttpError } from "../utils/httpError.js";

export function customerAccountRestriction(status: CustomerAccount["status"]): HttpError | null {
  if (status === "SUSPENDED") {
    return new HttpError(403, "Your account has been suspended.", {
      code: "CUSTOMER_ACCOUNT_SUSPENDED"
    });
  }
  if (status === "BANNED") {
    return new HttpError(403, "Your account has been banned.", {
      code: "CUSTOMER_ACCOUNT_BANNED"
    });
  }
  return null;
}
