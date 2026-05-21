import { SCORE_GOOD, SCORE_MID, SCORE_BAD, TYPE_COLORS } from './util.js';

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
 * Vysvětlivka barevné škály hodnocení (zelená/žlutá/červená).
 * Záměrně velmi jednoduchá – kdekoli jsou skóre v procentech.
 */
export function ScoreScaleLegend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-slate-800/60 dark:text-slate-300 ${className}`}>
      <span className="font-semibold">Jak číst barvy:</span>
      <Item color={SCORE_GOOD} text="zelená = výborné (75–100 %)" />
      <Item color={SCORE_MID} text="žlutá = průměrné (50–74 %)" />
      <Item color={SCORE_BAD} text="červená = slabé (0–49 %)" />
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
