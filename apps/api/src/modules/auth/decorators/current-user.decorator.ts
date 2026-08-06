import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminJwtPayload } from '../strategies/admin-jwt.strategy';
import type { CustomerJwtPayload } from '../strategies/customer-jwt.strategy';

/**
 * Extracts the validated JWT payload from the request.
 * Works for both admin and customer routes — the type of the payload differs
 * but both are stored on req.user by Passport.
 *
 * @example
 *   async getProfile(@CurrentUser() user: AdminJwtPayload) { ... }
 *   async getDashboard(@CurrentUser() customer: CustomerJwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminJwtPayload | CustomerJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: AdminJwtPayload | CustomerJwtPayload }>();
    return request.user;
  },
);
