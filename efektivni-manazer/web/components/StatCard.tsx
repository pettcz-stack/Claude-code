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
  tone?: "default" | "warn" | "danger" | "good" | "info";
  icon?: React.ReactNode;
}) {
  const toneRing = {
    default: "border-line",
    warn: "border-amber-500/40",
    danger: "border-rose-500/50",
    good: "border-emerald-500/40",
    info: "border-sky-500/40",
  }[tone];
  const toneValue = {
    default: "text-ink",
    warn: "text-amber-300",
    danger: "text-rose-300",
    good: "text-emerald-300",
    info: "text-sky-300",
  }[tone];
  const toneGlow = {
    default: "from-line/40",
    warn: "from-amber-500/20",
    danger: "from-rose-500/25",
    good: "from-emerald-500/20",
    info: "from-sky-500/20",
  }[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-panel p-4 transition hover:translate-y-[-1px] ${toneRing}`}
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${toneGlow} to-transparent opacity-60 blur-2xl`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
          <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneValue}`}>
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
        </div>
        {icon && <div className={`opacity-70 ${toneValue}`}>{icon}</div>}
      </div>
    </div>
  );
}
