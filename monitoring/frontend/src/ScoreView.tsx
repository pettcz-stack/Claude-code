import { useEffect, useState } from 'react';
import { Keyboard, Clock, AlertTriangle, AppWindow, Monitor, Shuffle, CalendarOff, MapPin } from 'lucide-react';
import { api, type UserScore, type User } from './api.js';
import { Donut } from './Donut.js';
import { ScoreScaleLegend } from './Legend.js';
import { AppIcon, useAppName } from './appMeta.js';
import { minutesToHm, chipClass, typeLabel, TYPE_COLORS, scoreColor } from './util.js';
import { useT } from './i18n/index.js';

function Card({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide muted-2">{icon} {title}</div>
      <div className={`text-lg font-semibold ${accent ?? ''}`}>{children}</div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="text-sm muted">{label}</span>
      <span className="ml-auto text-sm font-semibold">{value}</span>
    </div>
  );
}

export function ScoreView({ user, from, to }: { user: User; from: string; to: string }) {
  const { t } = useT();
  const appName = useAppName();
  const [s, setS] = useState<UserScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.score(user.id, from, to).then(setS).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [user.id, from, to]);

  if (loading) return <p className="muted-2">{t('common.loading')}</p>;
  if (error) return <p className="text-red-500">{t('scoreView.errorPrefix')}{error}</p>;
  if (!s) return null;

  function dayWord(n: number): string {
    if (n === 1) return t('scoreView.dayOne');
    if (n >= 2 && n <= 4) return t('scoreView.dayFew');
    return t('scoreView.dayMany');
  }

  const maxCat = Math.max(1, ...s.categories.map((c) => c.minutes));
  const absences = [
    s.vacationDays ? { label: t('scoreView.absVacation'), n: s.vacationDays, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' } : null,
    s.sickDays ? { label: t('scoreView.absSick'), n: s.sickDays, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' } : null,
    s.holidayDays ? { label: t('scoreView.absHoliday'), n: s.holidayDays, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' } : null,
  ].filter(Boolean) as { label: string; n: number; cls: string }[];

  return (
    <div className="space-y-4">
      <ScoreScaleLegend />
      {absences.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
          <CalendarOff size={16} className="shrink-0 text-sky-600 dark:text-sky-300" />
          <span className="font-medium">{t('scoreView.absencesLabel')}</span>
          {absences.map((a) => (
            <span key={a.label} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.cls}`}>{a.label}: {a.n} {dayWord(a.n)}</span>
          ))}
          <span className="muted-2">{t('scoreView.absencesNote')}</span>
        </div>
      )}
      <div className="grid gap-6 card p-6 md:grid-cols-2">
        <div className="flex items-center justify-center">
          <Donut
            size={220}
            segments={[
              { value: s.workPct, color: TYPE_COLORS.work },
              { value: s.nonWorkPct, color: TYPE_COLORS.nonwork },
              { value: s.idlePct, color: TYPE_COLORS.idle },
              { value: s.pcOffPct, color: TYPE_COLORS.off },
            ]}
            center={<>
              <div className="text-5xl font-bold" style={{ color: scoreColor(s.score) }}>{s.score}%</div>
              <div className="text-xs muted-2">{t('scoreView.workedOfFund')}</div>
              {s.monitorAdjusted && (
                <div className="mt-1 text-[10px] font-medium text-sky-500">{t('scoreView.monitorAdjusted', { raw: s.scoreRaw })}</div>
              )}
            </>}
          />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Legend color={TYPE_COLORS.work} label={t('scoreView.legWork')} value={`${s.workPct}% · ${minutesToHm(s.workMinutes)}`} />
          <Legend color={TYPE_COLORS.nonwork} label={t('scoreView.legFun')} value={`${s.nonWorkPct}% · ${minutesToHm(s.nonWorkMinutes)}`} />
          <Legend color={TYPE_COLORS.idle} label={t('scoreView.legIdle')} value={`${s.idlePct}% · ${minutesToHm(s.idleOnMinutes)}`} />
          <Legend color={TYPE_COLORS.off} label={t('scoreView.legOff')} value={`${s.pcOffPct}% · ${minutesToHm(s.pcOffMinutes)}`} />
          <p className="mt-1 text-xs muted-2">{t('scoreView.meetingsNote', { m: minutesToHm(s.meetingMinutes) })}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title={t('scoreView.cardKpmTitle')} icon={<Keyboard size={13} />}>
          {s.typingKpm > 0 ? s.typingKpm : s.avgKpm} <span className="text-sm font-normal muted">{t('scoreView.kpmUnit')}</span>
          <div className="mt-1 text-xs font-normal text-emerald-500">{t('scoreView.kpmNote', { n: s.kpmPercentile })} {s.kpmPercentile >= 50 ? '🎉' : ''}</div>
          {s.typingKpm > 0 && s.typingMinutes > 0 && (
            <div className="mt-1 text-[11px] muted-2" title={t('scoreView.kpmTypingMethodology')}>
              {t('scoreView.kpmTypingNote', { mins: minutesToHm(s.typingMinutes) })}
            </div>
          )}
        </Card>
        <Card title={t('scoreView.cardActiveWork')} icon={<Clock size={13} />} accent="text-emerald-500">{minutesToHm(s.workMinutes)}</Card>
        <Card title={t('scoreView.cardFun')} icon={<AlertTriangle size={13} />} accent="text-red-500">{minutesToHm(s.nonWorkMinutes)}</Card>
        <Card title={t('scoreView.cardTopApp')} icon={<AppWindow size={13} />}>
          {s.topApp
            ? <span className="flex items-center gap-2"><AppIcon app={s.topApp} size={16} /> {appName(s.topApp)}</span>
            : '—'}
        </Card>
        <Card title={t('scoreView.cardSiteDays')} icon={<MapPin size={13} />}>
          {s.siteDays && s.siteDays.length > 0
            ? <span className="flex flex-wrap gap-1.5">{s.siteDays.map((d) => (
                <span key={d.site} className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.site === 'Mimo firmu' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'}`}>{d.site === 'Mimo firmu' ? t('scoreView.siteOutside') : d.site}: {d.days}</span>
              ))}</span>
            : '—'}
        </Card>
        <Card title={t('scoreView.cardMonitors')} icon={<Monitor size={13} />}>
          {s.monitorTypical ? `${s.monitorTypical} ` : '— '}<span className="text-sm font-normal muted">{s.monitorTypical === 1 ? t('scoreView.screenOne') : s.monitorTypical >= 2 && s.monitorTypical <= 4 ? t('scoreView.screenFew') : t('scoreView.screenMany')}</span>
          <div className="mt-1 text-xs font-normal muted-2">{t('scoreView.multiMonitorPct', { n: s.multiMonitorPct })}</div>
        </Card>
        <Card title={t('scoreView.cardSwitches')} icon={<Shuffle size={13} />}>
          {s.appSwitchesPerHour} <span className="text-sm font-normal muted">{t('scoreView.switchesUnit')}</span>
          <div className="mt-1 text-xs font-normal muted-2">{t('scoreView.switchesNote')}</div>
        </Card>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('scoreView.categoriesTitle')}</h3>
        <div className="space-y-2">
          {s.categories.map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <div className="flex w-44 shrink-0 items-center gap-2 text-sm">
                <span className="truncate">{c.category}</span>
                <span className={chipClass(c.type)}>{typeLabel(c.type)}</span>
              </div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                <div className="h-full rounded-full" style={{ width: `${(c.minutes / maxCat) * 100}%`, background: c.type === 'NON_WORK' ? TYPE_COLORS.nonwork : c.type === 'WORK' ? TYPE_COLORS.work : TYPE_COLORS.idle }} />
              </div>
              <div className="w-20 text-right text-sm tabular-nums muted">{minutesToHm(c.minutes)}</div>
            </div>
          ))}
          {s.categories.length === 0 && <p className="text-sm muted-2">{t('scoreView.noCategories')}</p>}
        </div>
      </div>
    </div>
  );
}
