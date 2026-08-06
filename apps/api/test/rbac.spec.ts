import { describe, it, expect } from 'vitest';
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from '@vida/shared';

describe('RBAC matrix', () => {
  // ── OPERATIONS cannot approve money ──────────────────────────────────────
  it('OPERATIONS cannot verify payments', () => {
    expect(hasPermission('OPERATIONS', PERMISSIONS.PAYMENT_VERIFY)).toBe(false);
  });
  it('OPERATIONS cannot record offline payments', () => {
    expect(hasPermission('OPERATIONS', PERMISSIONS.PAYMENT_RECORD)).toBe(false);
  });
  it('OPERATIONS cannot waive interest', () => {
    expect(hasPermission('OPERATIONS', PERMISSIONS.INTEREST_WAIVE)).toBe(false);
  });
  it('OPERATIONS cannot write off invoices', () => {
    expect(hasPermission('OPERATIONS', PERMISSIONS.WRITE_OFF)).toBe(false);
  });
  it('OPERATIONS cannot create invoices', () => {
    expect(hasPermission('OPERATIONS', PERMISSIONS.INVOICE_CREATE)).toBe(false);
  });
  it('OPERATIONS cannot export reports (no PII bulk extract)', () => {
    expect(hasPermission('OPERATIONS', PERMISSIONS.REPORT_EXPORT)).toBe(false);
  });

  // ── ACCOUNTS cannot mutate the fleet ─────────────────────────────────────
  it('ACCOUNTS cannot create vehicles', () => {
    expect(hasPermission('ACCOUNTS', PERMISSIONS.VEHICLE_CREATE)).toBe(false);
  });
  it('ACCOUNTS cannot update vehicles', () => {
    expect(hasPermission('ACCOUNTS', PERMISSIONS.VEHICLE_UPDATE)).toBe(false);
  });
  it('ACCOUNTS cannot change vehicle status', () => {
    expect(hasPermission('ACCOUNTS', PERMISSIONS.VEHICLE_STATUS_CHANGE)).toBe(false);
  });
  it('ACCOUNTS cannot write maintenance records', () => {
    expect(hasPermission('ACCOUNTS', PERMISSIONS.MAINTENANCE_WRITE)).toBe(false);
  });
  it('ACCOUNTS cannot write rentals', () => {
    expect(hasPermission('ACCOUNTS', PERMISSIONS.RENTAL_WRITE)).toBe(false);
  });

  // ── VIEWER cannot export ──────────────────────────────────────────────────
  it('VIEWER cannot export reports', () => {
    expect(hasPermission('VIEWER', PERMISSIONS.REPORT_EXPORT)).toBe(false);
  });
  it('VIEWER cannot write invoices', () => {
    expect(hasPermission('VIEWER', PERMISSIONS.INVOICE_CREATE)).toBe(false);
  });
  it('VIEWER cannot verify payments', () => {
    expect(hasPermission('VIEWER', PERMISSIONS.PAYMENT_VERIFY)).toBe(false);
  });
  it('VIEWER cannot manage policy', () => {
    expect(hasPermission('VIEWER', PERMISSIONS.POLICY_MANAGE)).toBe(false);
  });
  it('VIEWER can read invoices', () => {
    expect(hasPermission('VIEWER', PERMISSIONS.INVOICE_READ)).toBe(true);
  });
  it('VIEWER can read reports', () => {
    expect(hasPermission('VIEWER', PERMISSIONS.REPORT_READ)).toBe(true);
  });

  // ── SUPER_ADMIN has everything ────────────────────────────────────────────
  it('SUPER_ADMIN has all permissions', () => {
    const allPerms = Object.values(PERMISSIONS);
    for (const perm of allPerms) {
      expect(hasPermission('SUPER_ADMIN', perm), `SUPER_ADMIN missing ${perm}`).toBe(true);
    }
  });

  // ── BRANCH_MANAGER has ops + accounts ────────────────────────────────────
  it('BRANCH_MANAGER can verify payments', () => {
    expect(hasPermission('BRANCH_MANAGER', PERMISSIONS.PAYMENT_VERIFY)).toBe(true);
  });
  it('BRANCH_MANAGER can change vehicle status', () => {
    expect(hasPermission('BRANCH_MANAGER', PERMISSIONS.VEHICLE_STATUS_CHANGE)).toBe(true);
  });
  it('BRANCH_MANAGER can terminate rentals', () => {
    expect(hasPermission('BRANCH_MANAGER', PERMISSIONS.RENTAL_TERMINATE)).toBe(true);
  });

  // ── Unknown role returns false ────────────────────────────────────────────
  it('unknown role has no permissions', () => {
    expect(hasPermission('MADE_UP_ROLE', PERMISSIONS.INVOICE_READ)).toBe(false);
  });
});
