import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function context(authorization?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = { headers: {} };
  if (authorization) request.headers['authorization'] = authorization;
  return { request, execution: { switchToHttp: () => ({ getRequest: () => request }) } };
}

describe('JwtAuthGuard', () => {
  it('validates the bearer token and attaches the server profile', async () => {
    const user = { id: 'verified-id', profile: { id: 'verified-id', role: 'USER' } };
    const auth = { validateAccessToken: vi.fn().mockResolvedValue(user) };
    const guard = new JwtAuthGuard(auth as never);
    const { request, execution } = context('Bearer signed-token');
    expect(await guard.canActivate(execution as never)).toBe(true);
    expect(auth.validateAccessToken).toHaveBeenCalledWith('signed-token');
    expect(request.user).toEqual(user);
  });

  it('rejects missing and malformed bearer headers without attempting validation', async () => {
    const auth = { validateAccessToken: vi.fn() };
    const guard = new JwtAuthGuard(auth as never);
    for (const header of [undefined, 'Basic abc', 'Bearer ']) {
      const { execution } = context(header);
      await expect(guard.canActivate(execution as never)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(auth.validateAccessToken).not.toHaveBeenCalled();
  });
});
