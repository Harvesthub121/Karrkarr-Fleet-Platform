/**
 * Shared API contract types. Imported by both Next.js apps and the NestJS API
 * so a breaking backend change fails the frontend typecheck in CI rather than
 * in production.
 *
 * NOTE ON MONEY OVER THE WIRE: bigint is not JSON-serialisable, so the API
 * emits cents as a `number` (safe: JS integers are exact to 2^53, which is
 * S$90 trillion) alongside a preformatted display string. Clients should
 * render `*Display` and compute with `*Cents`.
 */

export type Money = {
  cents: number;
  display: string; // "S$1,234.50"
};

export type AdminRoleName =
  | 'SUPER_ADMIN'
  | 'OPERATIONS'
  | 'ACCOUNTS'
  | 'BRANCH_MANAGER'
  | 'VIEWER';

export type VehicleStatusName =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED_OUT'
  | 'MAINTENANCE'
  | 'CLEANING'
  | 'INSPECTION'
  | 'ACCIDENT_REPAIR'
  | 'SOLD'
  | 'INACTIVE';

export type InvoiceStatusName =
  | 'UPCOMING'
  | 'DUE'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'REJECTED'
  | 'WRITTEN_OFF'
  | 'CANCELLED';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthedAdmin {
  id: string;
  email: string;
  fullName: string;
  role: AdminRoleName;
  branchId: string | null;
  branchName: string | null;
  permissions: string[];
}

export interface AuthedCustomer {
  id: string;
  customerRef: string;
  email: string;
  fullName: string;
}

/** Customer portal dashboard payload — one request, whole screen. */
export interface CustomerDashboard {
  customer: AuthedCustomer;
  rental: {
    agreementNo: string;
    status: string;
    vehicle: {
      plateNumber: string;
      make: string;
      model: string;
      year: number;
      photos: string[]; // presigned URLs
    };
    startDate: string;
    endDate: string;
    durationDays: number;
    remainingDays: number;
    billingFrequency: 'WEEKLY' | 'MONTHLY';
    rentAmount: Money;
  } | null;
  financials: {
    rentAmount: Money;
    depositPaid: Money;
    depositBalance: Money;
    accidentExcess: Money;
    outstandingBalance: Money;
    lateInterest: Money;
    currentAmountDue: Money;
    nextDueDate: string | null;
  };
  vehicleInfo: {
    nextServicingDate: string | null;
    inspectionDate: string | null;
    roadTaxExpiry: string | null;
    insuranceExpiry: string | null;
  };
  emergency: {
    roadsideName: string;
    roadsidePhone: string;
    supportEmail: string;
    supportPhone: string;
  };
}

export interface FleetOverview {
  totalVehicles: number;
  availableVehicles: number;
  currentlyRented: number;
  inMaintenance: number;
  returningSoon: number;
  paymentsDueToday: number;
  overduePayments: number;
  upcomingServicing: number;
  upcomingInspection: number;
  insuranceExpiring: number;
  roadTaxExpiring: number;
  coeExpiring: number;
  monthlyRevenue: Money;
  outstandingReceivables: Money;
  fleetUtilisationPct: number;
}

export interface CollectionsSummary {
  dueNext7Days: { count: number; total: Money };
  dueToday: { count: number; total: Money };
  overdue1to7: { count: number; total: Money };
  overdue8Plus: { count: number; total: Money };
  totalReceivables: Money;
  interestAccrued: Money;
}

export interface CollectionsRow {
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  customerRef: string;
  phone: string;
  plateNumber: string;
  branchName: string;
  dueDate: string;
  daysOverdue: number;
  bucket: 'UPCOMING_7' | 'DUE_TODAY' | 'OVERDUE_1_7' | 'OVERDUE_8_PLUS' | 'NOT_DUE';
  principal: Money;
  interest: Money;
  totalDue: Money;
  riskScore: number;
  lastReminderAt: string | null;
  remindersSent: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
