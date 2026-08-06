import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { differenceInDays, format, parseISO } from 'date-fns';
import type { Money, VehicleStatusName, InvoiceStatusName } from '@karrkarr/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(money: Money): string {
  return money.display;
}

export function formatDate(iso: string | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

export function daysFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    return differenceInDays(parseISO(iso), new Date());
  } catch {
    return null;
  }
}

export type ExpiryUrgency = 'critical' | 'warning' | 'ok' | 'expired';

export function getExpiryUrgency(days: number | null): ExpiryUrgency {
  if (days === null) return 'ok';
  if (days < 0) return 'expired';
  if (days <= 14) return 'critical';
  if (days <= 30) return 'warning';
  return 'ok';
}

// Vehicle status display config
type StatusConfig = { label: string; color: string; bg: string };

export const VEHICLE_STATUS_CONFIG: Record<VehicleStatusName, StatusConfig> = {
  AVAILABLE:      { label: 'Available',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  RESERVED:       { label: 'Reserved',        color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  RENTED_OUT:     { label: 'Rented Out',      color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200' },
  MAINTENANCE:    { label: 'Maintenance',     color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  CLEANING:       { label: 'Cleaning',        color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200' },
  INSPECTION:     { label: 'Inspection',      color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200' },
  ACCIDENT_REPAIR:{ label: 'Accident Repair', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  SOLD:           { label: 'Sold',            color: 'text-zinc-600',    bg: 'bg-zinc-100 border-zinc-300' },
  INACTIVE:       { label: 'Inactive',        color: 'text-zinc-500',    bg: 'bg-zinc-50 border-zinc-200' },
};

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatusName, StatusConfig> = {
  UPCOMING:             { label: 'Upcoming',             color: 'text-zinc-500',    bg: 'bg-zinc-50 border-zinc-200' },
  DUE:                  { label: 'Due',                  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  PENDING_VERIFICATION: { label: 'Pending Verification', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  PAID:                 { label: 'Paid',                 color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  PARTIALLY_PAID:       { label: 'Partially Paid',       color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200' },
  OVERDUE:              { label: 'Overdue',              color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  REJECTED:             { label: 'Rejected',             color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  WRITTEN_OFF:          { label: 'Written Off',          color: 'text-zinc-600',    bg: 'bg-zinc-100 border-zinc-300' },
  CANCELLED:            { label: 'Cancelled',            color: 'text-zinc-500',    bg: 'bg-zinc-50 border-zinc-200' },
};

export function pluralise(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`;
}
