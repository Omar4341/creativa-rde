import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/roles.enum.js';

export const ROLES_KEY = 'app:roles';

/**
 * Declares which roles may access the route. Enforced by RolesGuard.
 * Must be used together with JwtAuthGuard (roles are read from the server-verified profile).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
