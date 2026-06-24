import { z } from "zod";

const frontendEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default("YsabelleStore"),
  VITE_API_BASE_URL: z.string().url().default("http://localhost:3001")
});

export const frontendEnv = frontendEnvSchema.parse(import.meta.env);
