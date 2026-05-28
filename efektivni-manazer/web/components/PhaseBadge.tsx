import { PHASE_LABEL, PHASE_STYLE } from "@/lib/ui";

export function PhaseBadge({ phase }: { phase: string }) {
  const style = PHASE_STYLE[phase] || "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}
    >
      {PHASE_LABEL[phase] || phase}
    </span>
  );
}
