import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export const registerRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(["OWNER", "STAFF"])
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
export type RegisterRequestBody = z.infer<typeof registerRequestSchema>;
