import { useEffect, useState } from 'react';
import { Flame, LogOut as Exit, TrendingDown, TrendingUp, Sparkles, Minus, AlertCircle } from 'lucide-react';
import { api, type RiskSignals, type Reason } from './api.js';
import { useT } from './i18n/index.js';
import { useViewMode } from './viewMode.js';

/**
 * Detailní karta rizikových signálů pro KONKRÉTNÍHO uživatele.
 * Zobrazuje per-user 30denní vlastní průměr + 4 signály:
 *   - Vyhoření (burnoutRisk)
 *   - Odchod z firmy (flightRisk)
 *   - Trend výkonu (engagementTrend: zlepšuje se / zhoršuje / stabilní)
 *   - Pozitivní signál (boostSignal — pochvala manažera)
 *
 * Zobrazuje se v DetailView vedle IntegrityPanel (= podvádění, cheaty).
 * V Basic režimu skryje boostSignal pokud je nízký.
 */

function RiskRow({
  icon, color, bg, label, score, level, reasons, translateReason,
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  label: string;
  score: number;
  level?: 'low' | 'moderate' | 'high';
  reasons: Reason[];
  translateReason: (r: Reason) => string;
}) {
  const { t } = useT();
  return (
    <div className={`rounded-lg border border-gray-200 p-3 dark:border-slate-700/70 ${score >= 30 ? bg : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            {level === 'high' && <span className="chip-nonwork">{t('riskCard.levelHigh')}</span>}
            {level === 'moderate' && <span className="chip-warning">{t('riskCard.levelModerate')}</span>}
            {level === 'low' && <span className="chip-work">{t('riskCard.levelLow')}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold tabular-nums ${color}`}>{score}</div>
          <div className="text-[10px] muted-2">{t('riskCard.outOf100')}</div>
        </div>
      </div>
      <ul className="ml-12 mt-2 space-y-0.5 text-xs muted">
        {reasons.map((r, i) => (
          <li key={i}>· {translateReason(r)}</li>
        ))}
      </ul>
    </div>
  );
}

export function UserRiskCard({ userId, from, to }: { userId: string; from: string; to: string }) {
  const { t } = useT();
  const { isBasic } = useViewMode();
  const [sig, setSig] = useState<RiskSignals | null | 'loading' | 'noData'>('loading');
  useEffect(() => {
    setSig('loading');
    api.riskSignals(userId, from, to)
      .then((r) => setSig(r))
      .catch(() => setSig('noData'));
  }, [userId, from, to]);

  if (sig === 'loading') return null;
  if (sig === 'noData' || !sig) return null;
  if (sig.baseline.sampleDays < 5) {
    // Méně než 5 dní dat → nemůžeme férově soudit, zobrazíme info pásek
    return (
      <div className="card-dense flex items-center gap-3">
        <AlertCircle size={18} className="text-amber-500 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">{t('riskCard.notEnoughDataTitle')}</div>
          <div className="text-xs muted">
            {t('riskCard.notEnoughDataDesc', { days: String(sig.baseline.sampleDays) })}
          </div>
        </div>
      </div>
    );
  }

  // Sdílený překladač Reason kódů
  const translateReason = (r: Reason): string => {
    const p = r.params ?? {};
    const sp: Record<string, string> = {};
    for (const k of Object.keys(p)) sp[k] = String(p[k]);
    switch (r.code) {
      case 'AFTER_HOURS':         return t('insights.reasonAfterHours', sp);
      case 'WEEKEND_WORK':        return t('insights.reasonWeekendWork', sp);
      case 'SKIPPED_LUNCHES':     return t('insights.reasonSkippedLunches', sp);
      case 'OVER_ENGAGEMENT':     return t('insights.reasonOverEngagement', sp);
      case 'DECLINING_TREND':     return t('insights.reasonDecliningTrend', sp);
      case 'COLLABORATION_DROP':  return t('insights.reasonCollaborationDrop', sp);
      case 'JOB_BROWSING':        return t('insights.reasonJobBrowsing', sp);
      case 'IMPROVING_TREND':     return t('insights.reasonImprovingTrend', sp);
      case 'CONSISTENT_HIGH':     return t('insights.reasonConsistentHigh', sp);
      case 'NO_BURNOUT_SIGNS':    return t('insights.reasonNoBurnoutSigns');
      case 'NO_FLIGHT_SIGNS':     return t('insights.reasonNoFlightSigns');
      case 'STABLE_PERFORMANCE':  return t('insights.reasonStablePerformance');
      case 'STABLE_VS_BASELINE':  return t('insights.reasonStableVsBaseline', sp);
      case 'TREND_VS_BASELINE':   return t('insights.reasonTrendVsBaseline', { ...sp, delta: (Number(p.delta) > 0 ? '+' : '') + String(p.delta) });
    }
  };

  // Vykreslení trend ikonky
  const TrendIcon = sig.engagementTrend.direction === 'improving' ? TrendingUp
    : sig.engagementTrend.direction === 'declining' ? TrendingDown
    : Minus;
  const trendColor = sig.engagementTrend.direction === 'improving' ? 'text-emerald-600'
    : sig.engagementTrend.direction === 'declining' ? 'text-red-600'
    : 'text-gray-500';
  const trendBg = sig.engagementTrend.direction === 'improving' ? 'bg-emerald-50 dark:bg-emerald-500/10'
    : sig.engagementTrend.direction === 'declining' ? 'bg-red-50 dark:bg-red-500/10'
    : 'bg-gray-50 dark:bg-slate-700/30';

  const showBoost = sig.boostSignal.score >= 30 || !isBasic;

  return (
    <div className="card">
      {/* Header s baseline */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} className="text-emerald-500" />
          {t('riskCard.title')}
        </h3>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide muted-2">{t('riskCard.baseline')}</div>
          <div className="text-sm font-medium">
            {sig.baseline.avgScore30d} % {t('riskCard.baselineSuffix', { days: String(sig.baseline.sampleDays) })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Trend výkonu */}
        <div className={`rounded-lg border border-gray-200 p-3 dark:border-slate-700/70 ${trendBg}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${trendBg}`}>
              <TrendIcon size={16} className={trendColor} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {sig.engagementTrend.direction === 'improving' && t('riskCard.trendImprovingTitle')}
                {sig.engagementTrend.direction === 'declining' && t('riskCard.trendDecliningTitle')}
                {sig.engagementTrend.direction === 'stable' && t('riskCard.trendStableTitle')}
              </div>
              <div className="mt-0.5 text-xs muted">{translateReason(sig.engagementTrend.explainCode)}</div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold tabular-nums ${trendColor}`}>
                {sig.engagementTrend.score > 0 ? '+' : ''}{sig.engagementTrend.score}
              </div>
              <div className="text-[10px] muted-2">{t('riskCard.percentagePoints')}</div>
            </div>
          </div>
        </div>

        {/* Riziko vyhoření */}
        <RiskRow
          icon={<Flame size={16} className="text-red-600" />}
          color="text-red-600"
          bg="bg-red-50 dark:bg-red-500/10"
          label={t('riskCard.burnoutTitle')}
          score={sig.burnoutRisk.score}
          level={sig.burnoutRisk.level}
          reasons={sig.burnoutRisk.reasons}
          translateReason={translateReason}
        />

        {/* Riziko odchodu */}
        <RiskRow
          icon={<Exit size={16} className="text-amber-600" />}
          color="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-500/10"
          label={t('riskCard.flightRiskTitle')}
          score={sig.flightRisk.score}
          level={sig.flightRisk.level}
          reasons={sig.flightRisk.reasons}
          translateReason={translateReason}
        />

        {/* Pozitivní signál — jen pokud je vysoký nebo Pro režim */}
        {showBoost && (
          <RiskRow
            icon={<Sparkles size={16} className="text-emerald-600" />}
            color="text-emerald-600"
            bg="bg-emerald-50 dark:bg-emerald-500/10"
            label={t('riskCard.boostTitle')}
            score={sig.boostSignal.score}
            reasons={sig.boostSignal.reasons}
            translateReason={translateReason}
          />
        )}
      </div>

      <p className="mt-3 text-[11px] muted-2">
        {t('riskCard.footer')}
      </p>
    </div>
  );
}
