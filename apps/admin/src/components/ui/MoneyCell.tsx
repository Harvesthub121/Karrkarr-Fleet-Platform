import { cn } from '@/lib/utils';
import type { Money } from '@karrkarr/shared';

interface MoneyCellProps {
  value: Money;
  dim?: boolean;
  className?: string;
}

export function MoneyCell({ value, dim, className }: MoneyCellProps) {
  return (
    <span className={cn('tabular-nums slashed-zero', dim && 'text-zinc-400', className)}>
      {value.display}
    </span>
  );
}

interface MoneyCentsProps {
  cents: number;
  dim?: boolean;
  className?: string;
}

/** Formats raw cents as S$ display. For cases where only cents are available. */
export function MoneyCents({ cents, dim, className }: MoneyCentsProps) {
  const display = `S$${(cents / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <span className={cn('tabular-nums slashed-zero', dim && 'text-zinc-400', className)}>
      {display}
    </span>
  );
}
