interface Props {
  category?: string | null;
  confidence?: number | null;
}

const COLOR: Record<string, string> = {
  brand_attack: "bg-red-100 text-red-800 ring-red-300",
  vulgarity: "bg-orange-100 text-orange-800 ring-orange-300",
  spam: "bg-yellow-100 text-yellow-800 ring-yellow-300",
  legitimate_criticism: "bg-blue-100 text-blue-800 ring-blue-300",
  neutral: "bg-slate-100 text-slate-800 ring-slate-300",
  positive: "bg-emerald-100 text-emerald-800 ring-emerald-300",
};

const LABEL: Record<string, string> = {
  brand_attack: "útok na značku",
  vulgarity: "vulgarismus",
  spam: "spam",
  legitimate_criticism: "oprávněná kritika",
  neutral: "neutrální",
  positive: "pozitivní",
};

export default function CategoryPill({ category, confidence }: Props) {
  if (!category) return <span className="pill bg-slate-100 text-slate-500 ring-slate-300">neklasifikováno</span>;
  return (
    <span className={`pill ${COLOR[category] ?? "bg-slate-100"}`}>
      {LABEL[category] ?? category}
      {typeof confidence === "number" && (
        <span className="ml-1 opacity-70">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}
