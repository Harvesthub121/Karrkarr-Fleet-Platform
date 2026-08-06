import { statusBadgeClass, statusLabel } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={statusBadgeClass(status)}>
      {statusLabel(status)}
    </span>
  );
}
