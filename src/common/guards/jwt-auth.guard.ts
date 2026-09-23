import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = request.headers.authorization;
    if (!header || !/^Bearer\s+\S+$/i.test(header)) throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'A valid Bearer token is required.' });
    request.user = await this.auth.validateAccessToken(header.replace(/^Bearer\s+/i, ''));
    return true;
  }
}
