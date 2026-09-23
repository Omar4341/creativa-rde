import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),

  // Supabase — backend only (SERVICE_ROLE_KEY must NEVER reach the frontend)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Supabase — safe for Presenter Realtime subscription (frontend-visible)
  SUPABASE_ANON_KEY: z.string().min(1),

  // QR Token signing
  QR_JWT_SECRET: z.string().min(32, 'QR_JWT_SECRET must be at least 32 characters'),
  QR_TOKEN_EXPIRY_HOURS: z.coerce.number().int().positive().default(24),

  // CORS — comma-separated list of allowed origins
  ALLOWED_ORIGINS: z.string().min(1),

  // Rate limiting
  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses all required environment variables at application startup.
 * The application will refuse to start if any required variable is missing or invalid.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Environment validation failed. Fix the following issues:\n${formatted}`,
    );
  }

  return result.data;
}
