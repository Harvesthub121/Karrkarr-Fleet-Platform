import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CustomerJwtPayload } from '../strategies/customer-jwt.strategy';
import type { Request } from 'express';

/**
 * CustomerScopeGuard — ensures a customer can only access their own rows.
 *
 * Apply this guard to any customer-portal endpoint that operates on a resource
 * owned by a specific customer. The guard verifies that the `customerId` path
 * or query parameter matches the authenticated customer's own ID.
 *
 * Convention: the guarded route must expose the customer identifier as:
 *   - route param: :customerId, or
 *   - auto-derived: no param needed — use @CurrentUser() and compare in service.
 *
 * This guard enforces the param-based check. For service-level checks, the
 * service receives @CurrentUser() and should verify ownership itself.
 */
@Injectable()
export class CustomerScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user: CustomerJwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated as customer');

    // If the route has a :customerId param, enforce it matches the token subject.
    const paramCustomerId = req.params['customerId'];
    if (paramCustomerId && paramCustomerId !== user.sub) {
      throw new ForbiddenException('Access denied: you can only access your own data');
    }

    return true;
  }
}
