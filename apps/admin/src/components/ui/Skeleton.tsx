import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-zinc-100 rounded', className)} />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
