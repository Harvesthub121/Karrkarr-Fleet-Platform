import { cn, daysFromNow, getExpiryUrgency, formatDate } from '@/lib/utils';

const URGENCY_CLASSES = {
  expired: 'bg-red-50 border-red-300 text-red-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  ok: 'bg-zinc-50 border-zinc-200 text-zinc-600',
} as const;

interface DateChipProps {
  date: string | null | undefined;
  label?: string;
  className?: string;
}

export function DateChip({ date, label, className }: DateChipProps) {
  const days = daysFromNow(date);
  const urgency = getExpiryUrgency(days);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium border rounded tabular-nums',
        URGENCY_CLASSES[urgency],
        className,
      )}
    >
      {label && <span className="font-normal opacity-70">{label}</span>}
      <span>{formatDate(date)}</span>
      {days !== null && (
        <span className="opacity-70">
          {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'today' : `${days}d`}
        </span>
      )}
    </span>
  );
}
