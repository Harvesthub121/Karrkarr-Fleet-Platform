/**
 * Compiled fallback values for every configurable business rule.
 *
 * These are the LAST resort in the resolution chain:
 *   contract override -> branch PolicySetting -> global PolicySetting -> here.
 *
 * Everything here is editable by a SUPER_ADMIN in Settings without a deploy.
 * If you are tempted to hardcode a business number anywhere else in the
 * codebase, add a key here instead.
 */

export const POLICY_KEYS = {
  // --- Late payment ---------------------------------------------------------
  /** Simple daily interest on outstanding PRINCIPAL, in basis points/day. */
  INTEREST_RATE_BPS: 'billing.interestRateBps',
  /** Days after due date before interest starts accruing. */
  GRACE_PERIOD_DAYS: 'billing.gracePeriodDays',
  /** Hard ceiling on accrued interest as a % of principal. 0 = uncapped. */
  INTEREST_CAP_BPS: 'billing.interestCapBps',
  /** Flat administrative fee applied once when an invoice goes overdue. */
  LATE_FEE_FLAT_CENTS: 'billing.lateFeeFlatCents',

  // --- Reminder cadence -----------------------------------------------------
  /** Days BEFORE due date to send pre-due reminders. */
  REMINDER_DAYS_BEFORE: 'reminders.daysBefore',
  /** Send a reminder on the due date itself. */
  REMINDER_ON_DUE_DATE: 'reminders.onDueDate',
  /** Repeat interval (days) for overdue chasers, until paid. */
  REMINDER_OVERDUE_INTERVAL_DAYS: 'reminders.overdueIntervalDays',
  /** Stop automated chasing after N days overdue (escalate to human). */
  REMINDER_OVERDUE_MAX_DAYS: 'reminders.overdueMaxDays',
  /** Local hour (Asia/Singapore) at which the daily reminder sweep runs. */
  REMINDER_SEND_HOUR: 'reminders.sendHour',

  // --- Vehicle compliance ladders ------------------------------------------
  EXPIRY_ROAD_TAX_DAYS: 'expiry.roadTaxDaysBefore',
  EXPIRY_INSURANCE_DAYS: 'expiry.insuranceDaysBefore',
  EXPIRY_INSPECTION_DAYS: 'expiry.inspectionDaysBefore',
  EXPIRY_COE_DAYS: 'expiry.coeDaysBefore',
  EXPIRY_SERVICE_DAYS: 'expiry.serviceDaysBefore',
  /** Mileage remaining (km) that triggers a "service due" alert. */
  SERVICE_MILEAGE_THRESHOLD_KM: 'expiry.serviceMileageThresholdKm',

  // --- Rentals --------------------------------------------------------------
  /** Days before endDate at which a rental flips to ENDING_SOON. */
  RENTAL_ENDING_SOON_DAYS: 'rental.endingSoonDays',
  /** How far ahead invoices are generated. */
  INVOICE_LEAD_DAYS: 'billing.invoiceLeadDays',
  /** Days between invoice issue and due date. */
  INVOICE_PAYMENT_TERM_DAYS: 'billing.paymentTermDays',

  // --- Collections risk scoring --------------------------------------------
  RISK_WEIGHT_DAYS_OVERDUE: 'collections.riskWeightDaysOverdue',
  RISK_WEIGHT_LATE_COUNT: 'collections.riskWeightLateCount',
  RISK_WEIGHT_REJECTED_COUNT: 'collections.riskWeightRejectedCount',
  RISK_LOOKBACK_MONTHS: 'collections.riskLookbackMonths',

  // --- Company / payment rails ---------------------------------------------
  COMPANY_NAME: 'company.name',
  COMPANY_UEN: 'company.uen',
  PAYNOW_UEN: 'paynow.uen',
  PAYNOW_MERCHANT_NAME: 'paynow.merchantName',
  BANK_NAME: 'bank.name',
  BANK_ACCOUNT_NAME: 'bank.accountName',
  BANK_ACCOUNT_NUMBER: 'bank.accountNumber',
  BANK_SWIFT: 'bank.swift',
  ROADSIDE_ASSIST_NAME: 'support.roadsideName',
  ROADSIDE_ASSIST_PHONE: 'support.roadsidePhone',
  SUPPORT_EMAIL: 'support.email',
  SUPPORT_PHONE: 'support.phone',

  // --- Tax (unused: Vida Partners is NOT GST-registered) --------------------
  /** Kept at 0 so GST registration later is a settings change, not a rewrite. */
  TAX_RATE_BPS: 'tax.rateBps',
  TAX_REGISTERED: 'tax.registered',
} as const;

export type PolicyKey = (typeof POLICY_KEYS)[keyof typeof POLICY_KEYS];

/**
 * Default values. Note these are the values the business signed off on:
 *   - Simple daily interest, 1%/day of outstanding principal
 *   - 3 day grace period
 *   - Reminders at T-3, T-1, T-0, then every 3 days while overdue
 *   - COE ladder 90/60/30/7; road tax, insurance, inspection 30/14/7
 */
export const POLICY_DEFAULTS: Record<PolicyKey, string> = {
  [POLICY_KEYS.INTEREST_RATE_BPS]: '100', // 1.00% per day, simple
  [POLICY_KEYS.GRACE_PERIOD_DAYS]: '3',
  [POLICY_KEYS.INTEREST_CAP_BPS]: '0', // uncapped
  [POLICY_KEYS.LATE_FEE_FLAT_CENTS]: '0',

  [POLICY_KEYS.REMINDER_DAYS_BEFORE]: '3,1',
  [POLICY_KEYS.REMINDER_ON_DUE_DATE]: 'true',
  [POLICY_KEYS.REMINDER_OVERDUE_INTERVAL_DAYS]: '3',
  [POLICY_KEYS.REMINDER_OVERDUE_MAX_DAYS]: '90',
  [POLICY_KEYS.REMINDER_SEND_HOUR]: '9',

  [POLICY_KEYS.EXPIRY_ROAD_TAX_DAYS]: '30,14,7',
  [POLICY_KEYS.EXPIRY_INSURANCE_DAYS]: '30,14,7',
  [POLICY_KEYS.EXPIRY_INSPECTION_DAYS]: '30,14,7',
  [POLICY_KEYS.EXPIRY_COE_DAYS]: '90,60,30,7',
  [POLICY_KEYS.EXPIRY_SERVICE_DAYS]: '30,14,7',
  [POLICY_KEYS.SERVICE_MILEAGE_THRESHOLD_KM]: '1000',

  [POLICY_KEYS.RENTAL_ENDING_SOON_DAYS]: '14',
  [POLICY_KEYS.INVOICE_LEAD_DAYS]: '7',
  [POLICY_KEYS.INVOICE_PAYMENT_TERM_DAYS]: '7',

  [POLICY_KEYS.RISK_WEIGHT_DAYS_OVERDUE]: '2',
  [POLICY_KEYS.RISK_WEIGHT_LATE_COUNT]: '5',
  [POLICY_KEYS.RISK_WEIGHT_REJECTED_COUNT]: '8',
  [POLICY_KEYS.RISK_LOOKBACK_MONTHS]: '12',

  [POLICY_KEYS.COMPANY_NAME]: 'Vida Partners Pte Ltd',
  [POLICY_KEYS.COMPANY_UEN]: '202512345K',
  [POLICY_KEYS.PAYNOW_UEN]: '202512345K',
  [POLICY_KEYS.PAYNOW_MERCHANT_NAME]: 'VIDA PARTNERS PTE LTD',
  [POLICY_KEYS.BANK_NAME]: 'DBS Bank Ltd',
  [POLICY_KEYS.BANK_ACCOUNT_NAME]: 'Vida Partners Pte Ltd',
  [POLICY_KEYS.BANK_ACCOUNT_NUMBER]: '003-901234-5',
  [POLICY_KEYS.BANK_SWIFT]: 'DBSSSGSG',
  [POLICY_KEYS.ROADSIDE_ASSIST_NAME]: 'Vida 24/7 Roadside Assistance',
  [POLICY_KEYS.ROADSIDE_ASSIST_PHONE]: '+65 6100 2424',
  [POLICY_KEYS.SUPPORT_EMAIL]: 'support@vidapartners.com.sg',
  [POLICY_KEYS.SUPPORT_PHONE]: '+65 6100 8888',

  [POLICY_KEYS.TAX_RATE_BPS]: '0',
  [POLICY_KEYS.TAX_REGISTERED]: 'false',
};

/** Parse "30,14,7" into [30, 14, 7], sorted descending, de-duplicated. */
export function parseDayLadder(value: string): number[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 0),
    ),
  ].sort((a, b) => b - a);
}
