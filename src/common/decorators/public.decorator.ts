import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'app:isPublic';

/**
 * Marks a route as public — the global JwtAuthGuard skips it.
 * Default behavior is protected: every route WITHOUT @Public() requires a valid Bearer JWT.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
