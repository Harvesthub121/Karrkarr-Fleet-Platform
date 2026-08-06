import type { InvoiceStatusName } from '@vida/shared';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-SG', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Render the display string from a Money object (never do maths here). */
export function moneyDisplay(display: string): string {
  return display;
}

export function centsToDisplay(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}S$${dollars.toLocaleString('en-SG')}.${rem.toString().padStart(2, '0')}`;
}

export function statusBadgeClass(status: InvoiceStatusName | string): string {
  switch (status) {
    case 'PAID':
      return 'badge-paid';
    case 'PENDING_VERIFICATION':
      return 'badge-pending';
    case 'OVERDUE':
      return 'badge-overdue';
    case 'DUE':
    case 'UPCOMING':
      return 'badge-upcoming';
    default:
      return 'badge-rejected';
  }
}

export function statusLabel(status: InvoiceStatusName | string): string {
  switch (status) {
    case 'PAID': return 'Paid';
    case 'PENDING_VERIFICATION': return 'Pending Verification';
    case 'OVERDUE': return 'Overdue';
    case 'DUE': return 'Due';
    case 'UPCOMING': return 'Upcoming';
    case 'PARTIALLY_PAID': return 'Partially Paid';
    case 'REJECTED': return 'Rejected';
    case 'WRITTEN_OFF': return 'Written Off';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function documentTypeLabel(type: string): string {
  switch (type) {
    case 'RENTAL_AGREEMENT': return 'Rental Agreement';
    case 'VEHICLE_INSPECTION_FORM': return 'Vehicle Inspection Form';
    case 'INSURANCE_CERTIFICATE': return 'Insurance Certificate';
    case 'ROAD_TAX_CERTIFICATE': return 'Road Tax Certificate';
    case 'PAYMENT_RECEIPT': return 'Payment Receipt';
    case 'INVOICE': return 'Invoice';
    case 'PAYMENT_PROOF': return 'Payment Proof';
    case 'COE_CERTIFICATE': return 'COE Certificate';
    default: return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
}

export function documentGroupOrder(type: string): number {
  const order: Record<string, number> = {
    RENTAL_AGREEMENT: 0,
    VEHICLE_INSPECTION_FORM: 1,
    INSURANCE_CERTIFICATE: 2,
    ROAD_TAX_CERTIFICATE: 3,
    INVOICE: 4,
    PAYMENT_RECEIPT: 5,
    PAYMENT_PROOF: 6,
  };
  return order[type] ?? 99;
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
