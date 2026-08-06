import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  urgency?: 'normal' | 'warning' | 'critical' | 'ok';
  href?: string;
  className?: string;
}

const URGENCY_LEFT: Record<string, string> = {
  normal:   'border-l-zinc-300',
  ok:       'border-l-emerald-400',
  warning:  'border-l-amber-400',
  critical: 'border-l-red-500',
};

export function StatCard({ label, value, sub, urgency = 'normal', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-zinc-200 rounded-sm p-3 border-l-2',
        URGENCY_LEFT[urgency],
        className,
      )}
    >
      <p className="text-2xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 leading-none">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
