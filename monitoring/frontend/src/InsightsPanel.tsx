import { useEffect, useState } from 'react';
import { Flame, LogOut as Exit, TrendingDown, Sparkles, ArrowRight } from 'lucide-react';
import { api, type Insight, type Reason } from './api.js';
import { useT } from './i18n/index.js';
import { useViewMode } from './viewMode.js';

/**
 * Akční doporučení manažerovi — strategický differentiator vs konkurenci.
 * Backend vrací KÓDY + parametry, frontend překládá přes i18n. Čeština:
 * vyhoření / odchod / pokles výkonu / vynikající výkon (žádné anglicismy).
 */

const TYPE_META: Record<Insight['type'], { icon: typeof Flame; color: string; bgLight: string; bgDark: string; }> = {
  burnout:   { icon: Flame,        color: 'text-red-600',     bgLight: 'bg-red-50',     bgDark: 'dark:bg-red-500/10' },
  flight:    { icon: Exit,         color: 'text-amber-600',   bgLight: 'bg-amber-50',   bgDark: 'dark:bg-amber-500/10' },
  declining: { icon: TrendingDown, color: 'text-orange-600',  bgLight: 'bg-orange-50',  bgDark: 'dark:bg-orange-500/10' },
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
  if (insights.length === 0) return null;

  const shown = isBasic ? insights.slice(0, 3) : insights.slice(0, 6);

  // Překlad strukturovaných kódů z backendu → lokalizovaný text.
  // Pro každý jazyk pak stačí přeložit klíče v i18n souborech – žádné
  // anglicismy se nedostanou do české verze a EN má svoje "burnout" atd.
  const translateReason = (r: Reason): string => {
    const p = r.params ?? {};
    switch (r.code) {
      case 'AFTER_HOURS':         return t('insights.reasonAfterHours', { pct: String(p.pct) });
      case 'WEEKEND_WORK':        return t('insights.reasonWeekendWork', { days: String(p.days) });
      case 'SKIPPED_LUNCHES':     return t('insights.reasonSkippedLunches', { days: String(p.days), period: String(p.period) });
      case 'OVER_ENGAGEMENT':     return t('insights.reasonOverEngagement', { hours: String(p.hoursPerDay) });
      case 'DECLINING_TREND':     return t('insights.reasonDecliningTrend', { points: String(p.points) });
      case 'COLLABORATION_DROP':  return t('insights.reasonCollaborationDrop', { pct: String(p.pct) });
      case 'JOB_BROWSING':        return t('insights.reasonJobBrowsing', { count: String(p.count) });
      case 'IMPROVING_TREND':     return t('insights.reasonImprovingTrend', { points: String(p.points) });
      case 'CONSISTENT_HIGH':     return t('insights.reasonConsistentHigh', { avg: String(p.avg) });
      case 'NO_BURNOUT_SIGNS':    return t('insights.reasonNoBurnoutSigns');
      case 'NO_FLIGHT_SIGNS':     return t('insights.reasonNoFlightSigns');
      case 'STABLE_PERFORMANCE':  return t('insights.reasonStablePerformance');
      case 'STABLE_VS_BASELINE':  return t('insights.reasonStableVsBaseline', { avg: String(p.avg) });
      case 'TREND_VS_BASELINE':   return t('insights.reasonTrendVsBaseline', { delta: (p.delta > 0 ? '+' : '') + String(p.delta), baseline: String(p.baseline) });
    }
  };

  const translateHeadline = (ins: Insight): string => {
    const p = ins.params;
    switch (ins.code) {
      case 'BURNOUT_HIGH':         return t('insights.headlineBurnoutHigh', { name: String(p.name), score: String(p.score) });
      case 'FLIGHT_RISK_HIGH':     return t('insights.headlineFlightRiskHigh', { name: String(p.name), score: String(p.score) });
      case 'PERFORMANCE_DECLINING': return t('insights.headlineDeclining', { name: String(p.name), points: String(p.points) });
      case 'PERFORMANCE_BOOST':    return t('insights.headlineBoost', { name: String(p.name), score: String(p.score) });
    }
  };

  const translateAction = (ins: Insight): string => {
    switch (ins.code) {
      case 'BURNOUT_HIGH':          return t('insights.actionBurnoutHigh');
      case 'FLIGHT_RISK_HIGH':      return t('insights.actionFlightRiskHigh');
      case 'PERFORMANCE_DECLINING': return t('insights.actionDeclining');
      case 'PERFORMANCE_BOOST':     return t('insights.actionBoost');
    }
  };

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
              className="group w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-emerald-300 dark:border-slate-700/70 dark:hover:border-emerald-500/50"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bgLight} ${meta.bgDark}`}>
                  <Icon size={16} className={meta.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{translateHeadline(ins)}</span>
                    {ins.severity === 'high' && <span className="chip-nonwork">{t('insights.severityHigh')}</span>}
                  </div>
                  <div className="mt-1 text-xs muted">
                    {ins.reasons.map((r, j) => (
                      <span key={j}>
                        {j > 0 && ' · '}
                        {translateReason(r)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <ArrowRight size={12} className="opacity-70" />
                    <span>{translateAction(ins)}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!isBasic && insights.length > 6 && (
        <p className="mt-3 text-xs muted-2">
          {t('insights.moreHidden', { n: String(insights.length - 6) })}
        </p>
      )}
    </div>
  );
}
