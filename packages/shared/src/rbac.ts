/**
 * ROLE-BASED ACCESS CONTROL
 * =========================
 *
 * Permissions are declared as a flat, greppable list of `resource.action`
 * strings, and roles are defined as sets of them. Guards check permissions,
 * never roles — so adding a role later never means hunting through
 * `if (role === 'OPERATIONS')` branches scattered across the codebase.
 *
 * Two separations of duty are deliberate and should not be "simplified":
 *   - OPERATIONS can move vehicles but cannot approve money.
 *   - ACCOUNTS can approve money but cannot mutate the fleet.
 * That split is what makes the payment-verification workflow an actual
 * control rather than a formality.
 */

export const PERMISSIONS = {
  // Fleet
  VEHICLE_READ: 'vehicle.read',
  VEHICLE_CREATE: 'vehicle.create',
  VEHICLE_UPDATE: 'vehicle.update',
  VEHICLE_DELETE: 'vehicle.delete',
  VEHICLE_STATUS_CHANGE: 'vehicle.status_change',

  // Maintenance
  MAINTENANCE_READ: 'maintenance.read',
  MAINTENANCE_WRITE: 'maintenance.write',

  // Customers
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_WRITE: 'customer.write',
  CUSTOMER_PII_READ: 'customer.pii_read', // unmasked NRIC / licence

  // Rentals
  RENTAL_READ: 'rental.read',
  RENTAL_WRITE: 'rental.write',
  RENTAL_TERMINATE: 'rental.terminate',

  // Billing & money
  INVOICE_READ: 'invoice.read',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_CANCEL: 'invoice.cancel',
  PAYMENT_VERIFY: 'payment.verify', // approve/reject customer submissions
  PAYMENT_RECORD: 'payment.record', // record an offline payment
  INTEREST_WAIVE: 'interest.waive',
  WRITE_OFF: 'invoice.write_off',
  LEDGER_READ: 'ledger.read',

  // Collections
  COLLECTIONS_READ: 'collections.read',
  COLLECTIONS_ACTION: 'collections.action', // fire manual reminders

  // Reports
  REPORT_READ: 'report.read',
  REPORT_EXPORT: 'report.export',

  // Admin
  USER_MANAGE: 'user.manage',
  BRANCH_MANAGE: 'branch.manage',
  POLICY_MANAGE: 'policy.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

const OPERATIONS_PERMS: Permission[] = [
  P.VEHICLE_READ, P.VEHICLE_CREATE, P.VEHICLE_UPDATE, P.VEHICLE_STATUS_CHANGE,
  P.MAINTENANCE_READ, P.MAINTENANCE_WRITE,
  P.CUSTOMER_READ, P.CUSTOMER_WRITE,
  P.RENTAL_READ, P.RENTAL_WRITE,
  P.INVOICE_READ,
  P.REPORT_READ,
];

const ACCOUNTS_PERMS: Permission[] = [
  P.VEHICLE_READ,
  P.CUSTOMER_READ, P.CUSTOMER_PII_READ,
  P.RENTAL_READ,
  P.INVOICE_READ, P.INVOICE_CREATE, P.INVOICE_CANCEL,
  P.PAYMENT_VERIFY, P.PAYMENT_RECORD, P.INTEREST_WAIVE, P.WRITE_OFF, P.LEDGER_READ,
  P.COLLECTIONS_READ, P.COLLECTIONS_ACTION,
  P.REPORT_READ, P.REPORT_EXPORT,
];

const VIEWER_PERMS: Permission[] = [
  P.VEHICLE_READ, P.MAINTENANCE_READ, P.CUSTOMER_READ, P.RENTAL_READ,
  P.INVOICE_READ, P.LEDGER_READ, P.COLLECTIONS_READ, P.REPORT_READ,
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  /** Everything, including policy and user management. */
  SUPER_ADMIN: Object.values(P),

  OPERATIONS: OPERATIONS_PERMS,

  ACCOUNTS: ACCOUNTS_PERMS,

  /** Ops + Accounts, but hard-scoped to their own branch by BranchGuard. */
  BRANCH_MANAGER: [
    ...new Set([...OPERATIONS_PERMS, ...ACCOUNTS_PERMS, P.RENTAL_TERMINATE]),
  ],

  /** Read-only. Note the absence of REPORT_EXPORT — no bulk PII extraction. */
  VIEWER: VIEWER_PERMS,
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Roles whose access is confined to a single branch. SUPER_ADMIN and head
 * office roles with branchId = null see everything.
 */
export const BRANCH_SCOPED_ROLES = new Set(['BRANCH_MANAGER']);

export function isBranchScoped(role: string, branchId: string | null): boolean {
  if (role === 'SUPER_ADMIN') return false;
  return BRANCH_SCOPED_ROLES.has(role) || branchId !== null;
}
