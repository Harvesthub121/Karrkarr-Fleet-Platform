import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@karrkarr/shared';

export const PERMISSIONS_KEY = 'karrkarr:permissions';

/**
 * Declare which RBAC permissions a route requires.
 * Must be combined with @UseGuards(AdminJwtGuard, PermissionsGuard).
 *
 * @example
 *   @RequirePermissions(PERMISSIONS.VEHICLE_CREATE, PERMISSIONS.BRANCH_MANAGE)
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
