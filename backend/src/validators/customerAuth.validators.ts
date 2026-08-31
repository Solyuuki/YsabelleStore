import { z } from "zod";

import {
  normalizeCustomerEmail,
  normalizeCustomerUsername,
  normalizePhilippineMobile
} from "../utils/customerIdentity.js";

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

const customerEmailSchema = z.string().transform((value, context) => {
  const normalized = normalizeCustomerEmail(value);
  if (!normalized) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid email address."
    });
    return z.NEVER;
  }

  return normalized;
});

const optionalPhilippineMobileSchema = z
  .string()
  .max(40)
  .optional()
  .or(z.literal(""))
  .transform((value, context) => {
    if (!value || value.trim().length === 0) return undefined;

    const normalized = normalizePhilippineMobile(value);
    if (!normalized) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid Philippine mobile number."
      });
      return z.NEVER;
    }

    return normalized;
  });

const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

const rememberedAccountIdSchema = z.string().trim().min(1).max(191);

export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: customerUsernameSchema,
  email: customerEmailSchema,
  phone: optionalPhilippineMobileSchema,
  password: z.string().min(8).max(128)
});

export const customerLoginSchema = z.object({
  identifier: z.string().trim().min(1).max(191),
  password: z.string().min(1).max(128)
});

export const customerEmailAuthRequestSchema = z.object({
  email: customerEmailSchema
});

export const customerEmailAuthVerifySchema = z.object({
  email: customerEmailSchema,
  verificationCode: verificationCodeSchema,
  rememberFor30Days: z.boolean().optional()
});

export const customerRememberedContinueSchema = z.object({
  rememberedAccountId: rememberedAccountIdSchema
});

export const customerRememberedVerifySchema = z.object({
  rememberedAccountId: rememberedAccountIdSchema,
  verificationCode: verificationCodeSchema
});

export const customerPasswordRecoveryRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(191)
});

export const customerPasswordRecoveryVerifySchema = z.object({
  identifier: z.string().trim().min(1).max(191),
  verificationCode: verificationCodeSchema
});

export const customerPasswordResetSchema = z.object({
  newPassword: z.string().min(8).max(128)
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
export type CustomerEmailAuthRequest = z.infer<typeof customerEmailAuthRequestSchema>;
export type CustomerEmailAuthVerify = z.infer<typeof customerEmailAuthVerifySchema>;
export type CustomerPasswordRecoveryRequest = z.infer<typeof customerPasswordRecoveryRequestSchema>;
export type CustomerPasswordRecoveryVerify = z.infer<typeof customerPasswordRecoveryVerifySchema>;
export type CustomerPasswordReset = z.infer<typeof customerPasswordResetSchema>;
