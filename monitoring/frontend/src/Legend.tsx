import { TYPE_COLORS, SCORE_GRADIENT_CSS, scoreColor } from './util.js';

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} />;
}

function Item({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Dot color={color} /> {text}
    </span>
  );
}

/**
 * Vysvětlivka barevné škály hodnocení – plynulý přechod od červené (slabé)
 * přes oranžovou a žlutou po zelenou (výborné). Číslo má vždy odstín dle hodnoty.
 */
export function ScoreScaleLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg bg-gray-50 px-3 py-2 dark:bg-slate-800/60 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-xs font-semibold text-gray-600 dark:text-slate-300">Barevná škála skóre:</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full" style={{ background: SCORE_GRADIENT_CSS }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-medium">
        <span style={{ color: scoreColor(10) }}>0 % slabé</span>
        <span style={{ color: scoreColor(50) }}>50 % průměr</span>
        <span style={{ color: scoreColor(100) }}>100 % výborné</span>
      </div>
    </div>
  );
}

/** Vysvětlivka rozdělení času (práce / mimopráce / nečinnost / mimo PC). */
export function ActivityLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-slate-300 ${className}`}>
      <Item color={TYPE_COLORS.work} text="Pracoval" />
      <Item color={TYPE_COLORS.nonwork} text="Mimopracovní" />
      <Item color={TYPE_COLORS.idle} text="U PC, nečinný" />
      <Item color={TYPE_COLORS.off} text="Mimo PC" />
    </div>
  );
}
