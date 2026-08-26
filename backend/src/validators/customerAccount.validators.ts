import { z } from "zod";

import { normalizeCustomerUsername } from "../utils/customerIdentity.js";

const customerUsernameSchema = z.string().transform((value, context) => {
  const normalized = normalizeCustomerUsername(value);
  if (!normalized) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid customer username."
    });
    return z.NEVER;
  }

  return normalized;
});

const currentPasswordSchema = z.string().min(1).max(128);

export const customerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120)
  })
  .strict();

export const customerUsernameClaimSchema = z
  .object({
    username: customerUsernameSchema,
    currentPassword: currentPasswordSchema
  })
  .strict();

export const customerPasswordChangeSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: z.string().min(8).max(128)
  })
  .strict();

export const customerSessionRevokeOthersSchema = z
  .object({
    currentPassword: currentPasswordSchema
  })
  .strict();

export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateSchema>;
export type CustomerUsernameClaimInput = z.infer<typeof customerUsernameClaimSchema>;
export type CustomerPasswordChangeInput = z.infer<typeof customerPasswordChangeSchema>;
export type CustomerSessionRevokeOthersInput = z.infer<typeof customerSessionRevokeOthersSchema>;
