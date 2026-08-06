import { cn, VEHICLE_STATUS_CONFIG, INVOICE_STATUS_CONFIG } from '@/lib/utils';
import type { VehicleStatusName, InvoiceStatusName } from '@karrkarr/shared';

interface VehicleStatusBadgeProps {
  status: VehicleStatusName;
  className?: string;
}

export function VehicleStatusBadge({ status, className }: VehicleStatusBadgeProps) {
  const cfg = VEHICLE_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium border rounded',
        cfg.color,
        cfg.bg,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

interface InvoiceStatusBadgeProps {
  status: InvoiceStatusName;
  className?: string;
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const cfg = INVOICE_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium border rounded',
        cfg.color,
        cfg.bg,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
