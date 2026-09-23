import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation.js';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  QR_JWT_SECRET: 'a-secret-that-is-at-least-32-characters-long',
  QR_TOKEN_EXPIRY_HOURS: '24',
  ALLOWED_ORIGINS: 'http://localhost:3001',
  THROTTLE_TTL_SECONDS: '60',
  THROTTLE_LIMIT: '100',
  AUTH_THROTTLE_LIMIT: '10',
};

describe('validateEnv', () => {
  it('should pass with all valid values', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('should apply default PORT when not provided', () => {
    const env = validateEnv({ ...validEnv, PORT: undefined });
    expect(env.PORT).toBe(3000);
  });

  it('should throw when NODE_ENV is missing', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: undefined })).toThrow(
      'Environment validation failed',
    );
  });

  it('should throw when NODE_ENV is an invalid value', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      'Environment validation failed',
    );
  });

  it('should throw when QR_JWT_SECRET is shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ ...validEnv, QR_JWT_SECRET: 'too-short' }),
    ).toThrow('Environment validation failed');
  });

  it('should throw when SUPABASE_URL is not a valid URL', () => {
    expect(() =>
      validateEnv({ ...validEnv, SUPABASE_URL: 'not-a-url' }),
    ).toThrow('Environment validation failed');
  });

  it('should throw when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    expect(() =>
      validateEnv({ ...validEnv, SUPABASE_SERVICE_ROLE_KEY: undefined }),
    ).toThrow('Environment validation failed');
  });

  it('should throw when ALLOWED_ORIGINS is missing', () => {
    expect(() =>
      validateEnv({ ...validEnv, ALLOWED_ORIGINS: undefined }),
    ).toThrow('Environment validation failed');
  });

  it('should coerce PORT string to number', () => {
    const env = validateEnv({ ...validEnv, PORT: '4000' });
    expect(env.PORT).toBe(4000);
    expect(typeof env.PORT).toBe('number');
  });
});
