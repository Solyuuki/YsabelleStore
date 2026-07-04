import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export type LoginRequestBody = z.infer<typeof loginRequestSchema>;
