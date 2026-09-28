import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Global JWT guard. Every route requires a valid Supabase Bearer JWT
 * unless explicitly marked @Public(). The token is verified server-side
 * via supabase.auth.getUser() and the profile is attached to request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = request.headers.authorization;
    if (!header || !/^Bearer\s+\S+$/i.test(header)) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'A valid Bearer token is required.' });
    }
    request.user = await this.auth.validateAccessToken(header.replace(/^Bearer\s+/i, ''));
    return true;
  }
}
