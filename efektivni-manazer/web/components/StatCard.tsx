export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "good";
  icon?: React.ReactNode;
}) {
  const toneRing = {
    default: "border-line",
    warn: "border-amber-500/40",
    danger: "border-rose-500/50",
    good: "border-emerald-500/40",
  }[tone];
  const toneValue = {
    default: "text-ink",
    warn: "text-amber-300",
    danger: "text-rose-300",
    good: "text-emerald-300",
  }[tone];
  return (
    <div className={`rounded-xl border bg-panel p-4 ${toneRing}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
          <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneValue}`}>
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
        </div>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
    </div>
  );
}
