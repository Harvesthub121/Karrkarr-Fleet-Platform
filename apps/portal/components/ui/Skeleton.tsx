import { classNames } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={classNames(
        'animate-pulse rounded-md bg-gray-200',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}
