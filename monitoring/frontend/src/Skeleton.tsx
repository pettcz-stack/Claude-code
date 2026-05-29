export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** Obecný placeholder načítání stránky (KPI karty + obsah). */
export function PageSkeleton({ kpi = 4 }: { kpi?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: kpi }).map((_, i) => (
          <div key={i} className="card-dense">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
