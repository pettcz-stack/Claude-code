import { useEffect, useState } from 'react';
import { Flame, LogOut as Exit, TrendingDown, Sparkles, ArrowRight } from 'lucide-react';
import { api, type Insight } from './api.js';
import { useT } from './i18n/index.js';
import { useViewMode } from './viewMode.js';

/**
 * Insights panel — STRATEGIC differentiator vs konkurence (ActivTrak/Teramind).
 *
 * Místo "tady jsou všechny metriky" zobrazí **3-5 akčních doporučení**:
 *   - Petr ohrožen burnoutem → 1:1 rozhovor
 *   - Anna riskuje odchod → retention talk
 *   - Lisa skvělý výkon → pochval/povyš
 *
 * Hodnota pro manažera: ušetří mu týdně hodiny rozhodování "na koho se zaměřit".
 * Hodnota pro HR: predikuje churn/burnout PŘED tím než se to stane.
 */

const TYPE_META: Record<Insight['type'], { icon: typeof Flame; color: string; bgLight: string; bgDark: string; }> = {
  burnout:   { icon: Flame,        color: 'text-red-600',     bgLight: 'bg-red-50',    bgDark: 'dark:bg-red-500/10' },
  flight:    { icon: Exit,         color: 'text-amber-600',   bgLight: 'bg-amber-50',  bgDark: 'dark:bg-amber-500/10' },
  declining: { icon: TrendingDown, color: 'text-orange-600',  bgLight: 'bg-orange-50', bgDark: 'dark:bg-orange-500/10' },
  boost:     { icon: Sparkles,     color: 'text-emerald-600', bgLight: 'bg-emerald-50', bgDark: 'dark:bg-emerald-500/10' },
};

export function InsightsPanel({ from, to, department, onOpenUser }: {
  from: string; to: string; department?: string; onOpenUser: (id: string) => void;
}) {
  const { t } = useT();
  const { isBasic } = useViewMode();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  useEffect(() => {
    api.insights(from, to, department).then(setInsights).catch(() => setInsights([]));
  }, [from, to, department]);

  if (!insights) return null;
  if (insights.length === 0) return null; // nezobrazujeme prázdný panel

  // V Basic režimu jen top 3 nejvážnější
  const shown = isBasic ? insights.slice(0, 3) : insights.slice(0, 6);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} className="text-emerald-500" />
          {t('insights.title')}
        </h3>
        <span className="text-xs muted-2">{t('insights.subtitle')}</span>
      </div>
      <div className="space-y-2">
        {shown.map((ins, i) => {
          const meta = TYPE_META[ins.type];
          const Icon = meta.icon;
          return (
            <button
              key={i}
              onClick={() => onOpenUser(ins.userId)}
              className={`group w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-emerald-300 dark:border-slate-700/70 dark:hover:border-emerald-500/50`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bgLight} ${meta.bgDark}`}>
                  <Icon size={16} className={meta.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{ins.headline}</span>
                    {ins.severity === 'high' && <span className="chip-nonwork">{t('insights.severityHigh')}</span>}
                  </div>
                  <div className="mt-1 text-xs muted">{ins.detail}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <ArrowRight size={12} className="opacity-70" />
                    <span>{ins.action}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!isBasic && insights.length > 6 && (
        <p className="mt-3 text-xs muted-2">
          {t('insights.moreHidden', { n: insights.length - 6 })}
        </p>
      )}
    </div>
  );
}
