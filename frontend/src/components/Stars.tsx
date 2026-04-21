interface Props {
  value: number | null | undefined;
}

export default function Stars({ value }: Props) {
  if (typeof value !== "number" || value <= 0) return null;
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  const color = filled <= 2 ? "text-red-500" : filled === 3 ? "text-amber-500" : "text-emerald-500";
  return (
    <span className={`inline-flex items-center gap-0.5 ${color}`} title={`${filled}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden>
          {i < filled ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}
