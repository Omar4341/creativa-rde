import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { Role } from '../types/roles.enum.js';
import type { AuthenticatedUser } from '../../auth/auth.types.js';

/**
 * RBAC guard. Reads @Roles() metadata and checks the server-verified profile role.
 * Must run AFTER JwtAuthGuard (requires request.user to be populated).
 * The role is always read from the profiles table via the auth service — never from the client.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.profile) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'A valid Bearer token is required.' });
    }

    if (!required.includes(user.profile.role as Role)) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_ROLE', message: 'You do not have permission to perform this action.' });
    }
    return true;
  }
}
