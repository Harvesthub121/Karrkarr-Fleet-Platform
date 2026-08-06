import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@vida/shared';

export const PERMISSIONS_KEY = 'vida:permissions';

/**
 * Declare which RBAC permissions a route requires.
 * Must be combined with @UseGuards(AdminJwtGuard, PermissionsGuard).
 *
 * @example
 *   @RequirePermissions(PERMISSIONS.VEHICLE_CREATE, PERMISSIONS.BRANCH_MANAGE)
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
