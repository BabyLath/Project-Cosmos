import "dotenv/config";
import { z } from "zod";

// Fail fast on startup if required env vars are missing or malformed,
// instead of hitting undefined-is-not-a-function deep in a request handler.
// dotenv leaves unset-but-declared vars as "" rather than undefined,
// which would otherwise make z.coerce.number() try to parse "" and
// fail. Strip empty strings before validation so "optional" fields
// declared with no value in .env are actually treated as absent.
for (const key of Object.keys(process.env)) {
  if (process.env[key] === "") delete process.env[key];
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
