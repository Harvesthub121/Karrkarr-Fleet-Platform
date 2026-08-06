import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { Permission } from '@karrkarr/shared';
import type { AdminJwtPayload } from '../strategies/admin-jwt.strategy';

/**
 * PermissionsGuard — checks that the authenticated admin has all of the
 * permissions declared via @RequirePermissions() on the route.
 *
 * Must be used AFTER AdminJwtGuard (which populates req.user).
 * Customer routes never use this guard — they use CustomerScopeGuard instead.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Route has no @RequirePermissions — allow (the JWT guard already verified identity)
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user: AdminJwtPayload }>();
    const user = req.user;

    if (!user) throw new ForbiddenException('No authenticated user');

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
    }

    return true;
  }
}
