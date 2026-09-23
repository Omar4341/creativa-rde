import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.validation.js';

/**
 * Typed configuration service.
 * All env access goes through this service — no direct process.env reads in business code.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): string {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get supabaseUrl(): string {
    return this.config.get('SUPABASE_URL', { infer: true });
  }

  get supabaseServiceRoleKey(): string {
    return this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
  }

  get supabaseAnonKey(): string {
    return this.config.get('SUPABASE_ANON_KEY', { infer: true });
  }

  get qrJwtSecret(): string {
    return this.config.get('QR_JWT_SECRET', { infer: true });
  }

  get qrTokenExpiryHours(): number {
    return this.config.get('QR_TOKEN_EXPIRY_HOURS', { infer: true });
  }

  get allowedOrigins(): string[] {
    return this.config
      .get('ALLOWED_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get throttleTtlSeconds(): number {
    return this.config.get('THROTTLE_TTL_SECONDS', { infer: true });
  }

  get throttleLimit(): number {
    return this.config.get('THROTTLE_LIMIT', { infer: true });
  }

  get authThrottleLimit(): number {
    return this.config.get('AUTH_THROTTLE_LIMIT', { infer: true });
  }
}
