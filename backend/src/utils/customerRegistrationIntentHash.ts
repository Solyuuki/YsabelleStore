import { createHash } from "node:crypto";

export function hashCustomerRegistrationIntent(intentToken: string): string {
  return createHash("sha256").update(intentToken).digest("hex");
}
