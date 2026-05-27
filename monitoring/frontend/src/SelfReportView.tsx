import { useEffect, useState } from 'react';
import { ShieldCheck, X, Keyboard, Trophy, Users, Building2, Sparkles, Award, Footprints, Flame, HeartPulse, PersonStanding, GlassWater, Eye, Coffee, Wind, Target, Armchair, Activity, Quote, MapPin } from 'lucide-react';
import { api, type SelfReportData, type TipsData, type User } from './api.js';
import { TYPE_COLORS } from './util.js';
import { useT, type Locale } from './i18n/index.js';

const CAT_ICON: Record<string, React.ReactNode> = {
  stand: <PersonStanding size={16} className="text-rose-500" />,
  move: <Activity size={16} className="text-emerald-500" />,
  eyes: <Eye size={16} className="text-violet-500" />,
  breath: <Wind size={16} className="text-sky-500" />,
  air: <Wind size={16} className="text-cyan-500" />,
  water: <GlassWater size={16} className="text-sky-500" />,
  coffee: <Coffee size={16} className="text-amber-700" />,
  ergo: <Armchair size={16} className="text-teal-500" />,
  focus: <Target size={16} className="text-indigo-500" />,
  mood: <HeartPulse size={16} className="text-rose-500" />,
};
function catIcon(cat: string | null): React.ReactNode {
  return (cat && CAT_ICON[cat]) || <HeartPulse size={16} className="text-rose-500" />;
}

const HOUR = () => Math.floor(Date.now() / 3600000);
const DAY = () => Math.floor(Date.now() / 86400000);
function rotate<T>(arr: T[], counter: number): T | undefined {
  return arr.length ? arr[counter % arr.length] : undefined;
}

const LOCALE_TO_BCP47: Record<Locale, string> = {
  cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB', pl: 'pl-PL', de: 'de-DE',
};

// Sada odznaků – ID + ikona zůstávají v kódu, jména a popis čte i18n.
type Badge = { emoji: string; nameKey: string; descKey: string; earned: (r: SelfReportData) => boolean };
const BADGES: Badge[] = [
  { emoji: '🚀', nameKey: 'selfReport.badgeMachine', descKey: 'selfReport.badgeMachineDesc', earned: (r) => r.score >= 90 },
  { emoji: '⭐', nameKey: 'selfReport.badgeStarter', descKey: 'selfReport.badgeStarterDesc', earned: (r) => r.score >= 75 && r.score < 90 },
  { emoji: '🏆', nameKey: 'selfReport.badgeChampion', descKey: 'selfReport.badgeChampionDesc', earned: (r) => r.companyPercentile >= 90 },
  { emoji: '🥇', nameKey: 'selfReport.badgeDeptStar', descKey: 'selfReport.badgeDeptStarDesc', earned: (r) => r.deptPercentile >= 90 },
  { emoji: '🏎️', nameKey: 'selfReport.badgeFastFingers', descKey: 'selfReport.badgeFastFingersDesc', earned: (r) => r.kpmPercentile >= 80 },
  { emoji: '⌨️', nameKey: 'selfReport.badgeKeyboardMage', descKey: 'selfReport.badgeKeyboardMageDesc', earned: (r) => r.avgKpm >= 200 },
  { emoji: '🎯', nameKey: 'selfReport.badgeFocused', descKey: 'selfReport.badgeFocusedDesc', earned: (r) => r.appSwitchesPerHour > 0 && r.appSwitchesPerHour <= 8 },
  { emoji: '🧘', nameKey: 'selfReport.badgeFocusMaster', descKey: 'selfReport.badgeFocusMasterDesc', earned: (r) => r.appSwitchesPerHour > 0 && r.appSwitchesPerHour <= 5 },
  { emoji: '💎', nameKey: 'selfReport.badgeFunFree', descKey: 'selfReport.badgeFunFreeDesc', earned: (r) => r.nonWorkPct <= 5 },
  { emoji: '🛡️', nameKey: 'selfReport.badgeClean', descKey: 'selfReport.badgeCleanDesc', earned: (r) => r.nonWorkPct === 0 },
  { emoji: '🖥️', nameKey: 'selfReport.badgeDualView', descKey: 'selfReport.badgeDualViewDesc', earned: (r) => r.multiMonitorPct >= 50 },
  { emoji: '🐝', nameKey: 'selfReport.badgeBee', descKey: 'selfReport.badgeBeeDesc', earned: (r) => r.activeHours >= 140 },
  { emoji: '🔥', nameKey: 'selfReport.badgeFire', descKey: 'selfReport.badgeFireDesc', earned: (r) => r.activeHours >= 170 },
  { emoji: '🏃', nameKey: 'selfReport.badgeMarathon', descKey: 'selfReport.badgeMarathonDesc', earned: (r) => r.distanceMeters >= 5000 },
  { emoji: '💪', nameKey: 'selfReport.badgeBurner', descKey: 'selfReport.badgeBurnerDesc', earned: (r) => r.caloriesTyping >= 400 },
  { emoji: '⚡', nameKey: 'selfReport.badgeKeyKing', descKey: 'selfReport.badgeKeyKingDesc', earned: (r) => r.keystrokeTotal >= 300000 },
];
function earnedBadges(r: SelfReportData): Badge[] {
  const got = BADGES.filter((b) => b.earned(r));
  return got.length ? got : [{ emoji: '🌱', nameKey: 'selfReport.badgeBeginner', descKey: 'selfReport.badgeBeginnerDesc', earned: () => true }];
}

function Compare({ icon, label, pct, color, note }: { icon: React.ReactNode; label: string; pct: number; color: string; note: string }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">{icon} {label}</div>
      <div className="text-3xl font-bold leading-none" style={{ color }}>{pct}%</div>
      <div className="mb-2 mt-1 text-xs muted-2">{note}</div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

type Preloaded = { report: SelfReportData; tips: TipsData; modes: { funMode: boolean; healthMode: boolean; growthMode: boolean } };

export function SelfReportView({ user, from, to, preloaded }: { user?: User; from: string; to: string; preloaded?: Preloaded }) {
  const { t, locale } = useT();
  const bcp47 = LOCALE_TO_BCP47[locale];
  const [r, setR] = useState<SelfReportData | null>(preloaded?.report ?? null);
  const [tips, setTips] = useState<TipsData | null>(preloaded?.tips ?? null);
  const [showPrivacy, setShowPrivacy] = useState(true);
  const [funMode, setFunMode] = useState(preloaded?.modes.funMode ?? false);
  const [healthMode, setHealthMode] = useState(preloaded?.modes.healthMode ?? false);
  const [growthMode, setGrowthMode] = useState(preloaded?.modes.growthMode ?? false);
  useEffect(() => {
    if (preloaded) { setR(preloaded.report); return; }
    if (!user) return;
    api.selfReport(user.id, from, to).then(setR).catch(() => setR(null));
  }, [user?.id, from, to, preloaded]);
  useEffect(() => {
    if (preloaded) { setTips(preloaded.tips); return; }
    api.tips().then(setTips).catch(() => setTips(null));
  }, [preloaded]);
  useEffect(() => {
    if (preloaded) { setFunMode(preloaded.modes.funMode); setHealthMode(preloaded.modes.healthMode); setGrowthMode(preloaded.modes.growthMode); return; }
    api.getSettings().then((d) => { setFunMode(d.settings.funMode); setHealthMode(d.settings.healthMode); setGrowthMode(d.settings.growthMode); }).catch(() => undefined);
  }, [preloaded]);
  if (!r) return <p className="muted-2">{t('common.loading')}</p>;

  const distance = r.distanceMeters >= 1000 ? `${(r.distanceMeters / 1000).toFixed(1)} km` : `${r.distanceMeters} m`;
  const tip = tips ? rotate(tips.health, HOUR()) : undefined;
  const quote = tips ? rotate(tips.growth, DAY()) : undefined;
  const funFact = tips ? rotate(tips.fun, HOUR()) : undefined;

  const grade = r.score >= 70
    ? { t: t('selfReport.gradeGreat'), e: '🏆' }
    : r.score >= 45
    ? { t: t('selfReport.gradeGood'), e: '👍' }
    : { t: t('selfReport.gradeImprove'), e: '💪' };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">{t('selfReport.myReport')}</div>
            <div className="text-2xl font-bold">{r.displayName}</div>
            <div className="text-sm opacity-90">{r.department}</div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
              <MapPin size={13} /> {t('selfReport.currentSite')}: {r.currentSite}
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-extrabold">{r.score}%</div>
            <div className="text-sm opacity-90">{grade.e} {grade.t}</div>
          </div>
        </div>
      </div>

      {growthMode && quote && (
        <div className="card flex items-start gap-3 border-indigo-200 p-5 dark:border-indigo-500/30">
          <Quote size={26} className="shrink-0 text-indigo-400" />
          <div>
            <div className="text-xs uppercase tracking-wide muted-2">{t('selfReport.wisdomOfDay')}</div>
            <blockquote className="text-lg font-medium italic">„{quote.text}"</blockquote>
            <div className="mt-1 text-sm muted">— {quote.author}</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Compare icon={<Users size={15} className="text-emerald-600" />} label={t('selfReport.inCompany')} pct={r.companyPercentile} color="#10b981" note={t('selfReport.efficiencyNote')} />
        <Compare icon={<Building2 size={15} className="text-emerald-600" />} label={t('selfReport.inDept')} pct={r.deptPercentile} color="#0ea5e9" note={t('selfReport.efficiencyNote')} />
        <Compare icon={<Keyboard size={15} className="text-emerald-600" />} label={t('selfReport.typingSpeed')} pct={r.kpmPercentile} color="#8b5cf6" note={t('selfReport.typingNote')} />
      </div>

      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-emerald-500" /> {t('selfReport.yourNumbers')}</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t('selfReport.scoreLabel')} value={`${r.score} %`} />
          <Stat label={t('selfReport.activeWorkLabel')} value={`${r.activeHours} h`} />
          <Stat label={t('selfReport.pacePerMin')} value={`${r.avgKpm} ${t('selfReport.paceUnit')}`} />
          <Stat
            label={t('selfReport.monitorsLabel')}
            value={r.monitorTypical ? `${r.monitorTypical} ${r.monitorTypical === 1 ? t('selfReport.monitor1') : t('selfReport.monitor2')}` : '—'}
          />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Trophy size={16} className="mt-0.5 shrink-0" />
          <span>{t('selfReport.achievementBanner', { kpm: r.kpmPercentile, co: r.companyPercentile })}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase muted-2">{t('selfReport.focusBlocks')}</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{r.focusSessions}×</div>
          <div className="text-xs muted-2">
            {r.focusMinutes > 0
              ? t('selfReport.focusHoursDesc', { h: (Math.round(r.focusMinutes / 60 * 10) / 10).toString() })
              : t('selfReport.focusNoBlocks')}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase muted-2">{t('selfReport.bestHour')}</div>
          <div className="mt-1 text-2xl font-bold">{r.bestHourLabel ?? '—'}</div>
          <div className="text-xs muted-2">{r.bestHourLabel ? t('selfReport.bestHourTip') : t('selfReport.bestHourNoData')}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase muted-2">{t('selfReport.weekDelta')}</div>
          {r.trendDeltaPct === null
            ? <div className="mt-1 text-2xl font-bold muted-2">—</div>
            : <div className={`mt-1 text-2xl font-bold ${r.trendDeltaPct > 0 ? 'text-emerald-600' : r.trendDeltaPct < 0 ? 'text-red-500' : ''}`}>{r.trendDeltaPct > 0 ? '+' : ''}{r.trendDeltaPct} %</div>}
          <div className="text-xs muted-2">
            {r.lastWeekScore !== null && r.priorWeekScore !== null
              ? t('selfReport.weekDeltaDetail', { a: r.lastWeekScore, b: r.priorWeekScore })
              : t('selfReport.weekDeltaNoData')}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-emerald-500" /> {t('selfReport.pcBreakdown')}</h3>
        <p className="mb-3 text-xs muted-2">{t('selfReport.pcBreakdownSub')}</p>
        <div className="mb-3 flex h-5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
          <div style={{ width: `${r.pcWorkPct}%`, background: TYPE_COLORS.work }} />
          <div style={{ width: `${r.pcNonWorkPct}%`, background: TYPE_COLORS.nonwork }} />
          <div style={{ width: `${r.pcUnknownPct}%`, background: '#f59e0b' }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><div className="text-2xl font-bold" style={{ color: TYPE_COLORS.work }}>{r.pcWorkPct} %</div><div className="text-xs muted-2">{t('selfReport.pcWorked')}</div></div>
          <div><div className="text-2xl font-bold" style={{ color: TYPE_COLORS.nonwork }}>{r.pcNonWorkPct} %</div><div className="text-xs muted-2">{t('selfReport.pcFun')}</div></div>
          <div><div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{r.pcUnknownPct} %</div><div className="text-xs muted-2">{t('selfReport.pcUnmeasured')}</div></div>
        </div>
      </div>

      {funMode && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-amber-500" /> {t('selfReport.awardsTitle')}</h3>
          {(() => {
            const got = earnedBadges(r);
            return (
              <>
                <p className="mb-3 text-xs muted-2">{t('selfReport.awardsGot', { a: got.length, b: BADGES.length })}</p>
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {got.map((b) => (
                    <div key={b.nameKey} className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <span className="shrink-0 text-2xl leading-none">{b.emoji}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-amber-800 dark:text-amber-300">{t(b.nameKey)}</div>
                        <div className="text-[11px] leading-tight muted-2">{t(b.descKey)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          {funFact && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Sparkles size={16} className="mt-0.5 shrink-0" /> <span><b>{t('selfReport.didYouKnow')}</b> {funFact.text}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs uppercase muted-2"><Footprints size={13} /> {t('selfReport.distanceTitle')}</div>
              <div className="text-2xl font-bold">{distance}</div>
              <div className="text-xs muted-2">{t('selfReport.distanceDesc')}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs uppercase muted-2"><Flame size={13} /> {t('selfReport.caloriesTitle')}</div>
              <div className="text-2xl font-bold">{r.caloriesTyping} kcal</div>
              <div className="text-xs muted-2">{t('selfReport.caloriesDesc')}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs uppercase muted-2"><Award size={13} /> {t('selfReport.keystrokesTitle')}</div>
              <div className="text-2xl font-bold">{r.keystrokeTotal.toLocaleString(bcp47)}</div>
              <div className="text-xs muted-2">{t('selfReport.keystrokesDesc')}</div>
            </div>
          </div>
        </div>
      )}

      {healthMode && tip && (
        <div className="card border-rose-200 p-5 dark:border-rose-500/30">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-300"><HeartPulse size={16} /> {t('selfReport.tipTitle')}</h3>
          <p className="mb-3 text-xs muted-2">{t('selfReport.tipSub')}</p>
          <div className="flex items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm dark:bg-rose-500/10">
            {catIcon(tip.category)} <span><b>{t('selfReport.tipNow')}:</b> {tip.text}</span>
          </div>
          <p className="mt-3 text-xs muted-2">{t('selfReport.tipRotates')}</p>
        </div>
      )}

      {showPrivacy && (
        <div className="card relative border-emerald-300 p-5 dark:border-emerald-500/40">
          <button onClick={() => setShowPrivacy(false)} className="absolute right-3 top-3 muted-2 hover:text-gray-600" title={t('selfReport.hide')}><X size={16} /></button>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck size={18} /> {t('selfReport.privacyTitle')}</h3>
          <p className="text-sm muted">{t('selfReport.privacyBody')}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide muted-2">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
