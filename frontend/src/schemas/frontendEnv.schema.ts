import { z } from "zod";

const frontendEnvSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default("YsabelleStore"),
  VITE_APP_VERSION: z.string().min(1).default("0.1.0"),
  VITE_API_BASE_URL: z.string().url().default("http://localhost:3001")
});

const parsedFrontendEnv = frontendEnvSchema.safeParse(import.meta.env);

if (!parsedFrontendEnv.success) {
  throw new Error(`Invalid frontend environment: ${parsedFrontendEnv.error.message}`);
}

export const frontendEnv = parsedFrontendEnv.data;
