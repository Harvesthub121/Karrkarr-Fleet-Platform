import { cn } from '@/lib/utils';

interface RiskBarProps {
  score: number; // 0-100
  showLabel?: boolean;
  className?: string;
}

function getRiskColor(score: number): string {
  if (score >= 75) return 'bg-red-500';
  if (score >= 50) return 'bg-orange-400';
  if (score >= 25) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function getRiskLabel(score: number): string {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Med-High';
  if (score >= 25) return 'Medium';
  return 'Low';
}

export function RiskBar({ score, showLabel = false, className }: RiskBarProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', getRiskColor(clampedScore))}
          style={{ width: `${clampedScore}%` }}
        />
      </div>
      <span className="tabular-nums text-2xs text-zinc-500">{clampedScore}</span>
      {showLabel && (
        <span className="text-2xs text-zinc-400">{getRiskLabel(clampedScore)}</span>
      )}
    </div>
  );
}
