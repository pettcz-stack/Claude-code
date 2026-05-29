import { useEffect, useState } from 'react';
import { Gauge, Clock, Wifi, ShieldAlert, AlertTriangle, ArrowUp, ArrowDown, Minus, Monitor, Lightbulb, MapPin, Building2, House } from 'lucide-react';
import { api, type Overview, type MonitorsData } from './api.js';
import { Donut } from './Donut.js';
import { TrendChart } from './TrendChart.js';
import { HeatmapView } from './HeatmapView.js';
import { PageSkeleton } from './Skeleton.js';
import { ScoreScaleLegend } from './Legend.js';
import { TYPE_COLORS, scoreHex, scoreColor } from './util.js';
import { useT } from './i18n/index.js';
import { useViewMode } from './viewMode.js';
import { InsightsPanel } from './InsightsPanel.js';
import { MetricInfo } from './MetricInfo.js';
import { EmptyState } from './EmptyState.js';

function Kpi({ icon, label, value, sub, accent, color, info }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; accent?: string; color?: string; info?: string }) {
  return (
    <div className="card-dense">
      <div className="mb-1 flex items-center gap-1.5 kpi-label">{icon} {label}{info && <MetricInfo text={info} />}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ?? ''}`} style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

function Delta({ d }: { d: number | null }) {
  const { t } = useT();
  if (d === null) return <span className="muted-2 flex items-center gap-0.5"><Minus size={12} /> {t('overview.deltaNoComparison')}</span>;
  if (d === 0) return <span className="muted-2 flex items-center gap-0.5"><Minus size={12} /> {t('overview.deltaNoChange')}</span>;
  const up = d > 0;
  return (
    <span className={`flex items-center gap-0.5 ${up ? 'text-emerald-500' : 'text-red-500'}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {up ? '+' : ''}{d} {t('overview.deltaVsLast')}
    </span>
  );
}

export function OverviewView({ from, to, department, dark, onOpenUser }: {
  from: string; to: string; department?: string; dark: boolean; onOpenUser: (id: string) => void;
}) {
  const { t } = useT();
  const { isBasic } = useViewMode();
  const [o, setO] = useState<Overview | null>(null);
  const [mon, setMon] = useState<MonitorsData | null>(null);
  useEffect(() => { api.overview(from, to, department).then(setO).catch(() => setO(null)); }, [from, to, department]);
  useEffect(() => { api.monitors(from, to, department).then(setMon).catch(() => setMon(null)); }, [from, to, department]);
  if (!o) return <PageSkeleton />;

  // Žádné zařízení = onboarding stav. Žádné aktivity = data zatím nedoběhly.
  if (o.kpi.deviceCount === 0) {
    return <div className="card p-5"><EmptyState variant="noDevices" /></div>;
  }
  if (o.kpi.userCount === 0 && o.kpi.deviceCount > 0) {
    return <div className="card p-5"><EmptyState variant="noDataYet" /></div>;
  }

  const employeeWord = (n: number) =>
    n === 1 ? t('overview.employeeOne') : n >= 2 && n <= 4 ? t('overview.employeeFew') : t('overview.employeeMany');

  return (
    <div className="space-y-4">
      <ScoreScaleLegend />

      {/* Manager insights panel – kompozitní signály (burnout/flight/declining/boost).
          Zobrazí se nahoře, nad raw KPI, protože akční doporučení > čísla. */}
      <InsightsPanel from={from} to={to} department={department} onOpenUser={onOpenUser} />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Gauge size={13} />} label={t('overview.kpiAvgScore')} value={`${o.kpi.avgScore} %`} color={scoreColor(o.kpi.avgScore)} sub={<Delta d={o.kpi.avgScoreDelta} />}
          info={t('methodology.avgScore')} />
        <Kpi icon={<Clock size={13} />} label={t('overview.kpiActiveWork')} value={`${o.kpi.activeHours} h`} sub={<span className="muted-2">{t('overview.kpiActiveWorkSub', { n: o.kpi.userCount })}</span>}
          info={t('methodology.activeWork')} />
        <Kpi icon={<Wifi size={13} />} label={t('overview.kpiOnlineNow')} value={`${o.kpi.onlineCount}`} sub={<span className="muted-2">{t('overview.kpiOnlineSub', { n: o.kpi.deviceCount })}</span>}
          info={t('methodology.online')} />
        <Kpi icon={<ShieldAlert size={13} />} label={t('overview.kpiSuspicion')} value={`${o.kpi.flaggedCount}`} accent={o.kpi.flaggedCount ? 'text-red-500' : ''} sub={<span className="muted-2">{t('overview.kpiSuspicionSub')}</span>}
          info={t('methodology.suspicion')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rozdělení času */}
        <div className="card flex flex-col items-center justify-center p-6">
          <h3 className="mb-3 self-start text-sm font-semibold">{t('overview.timeSplit')}<MetricInfo text={t('methodology.timeSplit')} /></h3>
          <Donut
            size={170}
            segments={[
              { value: o.split.work, color: TYPE_COLORS.work },
              { value: o.split.nonwork, color: TYPE_COLORS.nonwork },
              { value: o.split.idle, color: TYPE_COLORS.idle },
              { value: o.split.pcoff, color: TYPE_COLORS.off },
            ]}
            center={<><div className="text-xl font-bold">{o.split.work} h</div><div className="text-xs muted-2">{t('overview.timeSplitCenter')}</div></>}
          />
          <div className="mt-3 grid w-full grid-cols-2 gap-1 text-xs">
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.work }} /> {t('overview.timeSplitWork')}: {o.split.work} h</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.nonwork }} /> {t('overview.timeSplitFun')}: {o.split.nonwork} h</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.idle }} /> {t('overview.timeSplitIdle')}: {o.split.idle} h</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.off }} /> {t('overview.timeSplitOff')}: {o.split.pcoff} h</span>
          </div>
        </div>

        {/* Srovnání oddělení */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold">{t('overview.deptScore')}<MetricInfo text={t('methodology.deptScore')} /></h3>
          <p className="mb-3 text-xs muted-2">{t('overview.deptScoreSub')}</p>
          <div className="space-y-2.5">
            {o.departments.map((d) => (
              <div key={d.department} className="flex items-center gap-3">
                <div className="w-44 shrink-0 truncate text-sm" title={d.department}>{d.department} <span className="muted-2">({d.users})</span></div>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.avgScore}%`, background: scoreHex(d.avgScore) }} />
                </div>
                <div className="w-12 text-right text-sm font-bold tabular-nums" style={{ color: scoreColor(d.avgScore) }}>{d.avgScore}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kde se pracuje (podle lokální sítě) */}
      {o.locations && o.locations.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-sky-500" /> {t('overview.wherePeopleWork')}</h3>
          <p className="mb-3 text-xs muted-2">{t('overview.wherePeopleWorkSub')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {o.locations.map((l) => {
              const out = l.site === 'Mimo firmu';
              const siteLabel = out ? t('overview.outsideCompany') : l.site;
              return (
                <div key={l.site} className="rounded-lg border border-gray-200 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-xs muted-2">{out ? <House size={13} /> : <Building2 size={13} className="text-sky-500" />} {siteLabel}</div>
                  <div className="text-2xl font-bold">{l.users}</div>
                  <div className="text-xs muted-2">{employeeWord(l.users)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top / Bottom */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankCard title={t('overview.topEmployees')} rows={o.top} good onOpenUser={onOpenUser} />
        <RankCard title={t('overview.bottomEmployees')} rows={o.bottom} onOpenUser={onOpenUser} />
      </div>

      {/* Efektivita podle počtu monitorů – PRO only (hloubková analýza) */}
      {mon && !isBasic && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Monitor size={16} className="text-emerald-600" /> {t('overview.scoreByMonitors')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <MonitorBox label={t('overview.monitorBox1')} data={mon.single} />
            <MonitorBox label={t('overview.monitorBoxMulti')} data={mon.multi} />
          </div>
          <p className="mt-3 text-xs muted-2">
            {t('overview.monitorBoxNote')}
          </p>
        </div>
      )}

      {/* Manažerská doporučení (interpretace dat – nezasahuje do nich) */}
      {mon && mon.advice.candidates.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} className="text-amber-500" /> {t('overview.managerRecs')}</h3>
          <p className="mb-3 text-xs muted-2">
            {t('overview.managerRecsSub', { low: mon.advice.upliftLowPct, high: mon.advice.upliftHighPct })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">{t('overview.colEmployee')}</th><th className="th">{t('overview.colDept')}</th>
                  <th className="th">{t('overview.colDominantWork')}</th><th className="th text-right">{t('overview.colMonitors')}</th>
                  <th className="th text-right">{t('overview.colWorkedHours')}</th><th className="th text-right">{t('overview.colReclaim')}</th>
                </tr>
              </thead>
              <tbody>
                {mon.advice.candidates.slice(0, 10).map((c) => (
                  <tr key={c.userId} className="divide-row">
                    <td className="td font-medium">{c.displayName ?? '—'}</td>
                    <td className="td muted">{c.department ?? '—'}</td>
                    <td className="td muted">{c.dominantCategory}</td>
                    <td className="td text-right tabular-nums">{c.monitors}</td>
                    <td className="td text-right tabular-nums">{c.activeHours} h</td>
                    <td className="td text-right tabular-nums font-semibold text-emerald-500">+{c.reclaimHoursLow}–{c.reclaimHoursHigh} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mon.advice.candidates.length > 10 && (
            <p className="mt-2 text-xs muted-2">{t('overview.moreEmployeesNote', { n: mon.advice.candidates.length - 10 })}</p>
          )}
          <p className="mt-3 text-xs muted-2">
            {t('overview.reclaimDef')}
          </p>
        </div>
      )}

      <TrendChart from={from} to={to} department={department} dark={dark} />
      <HeatmapView from={from} to={to} department={department} />
    </div>
  );
}

function MonitorBox({ label, data }: { label: string; data: { users: number; avgScore: number; avgActiveHours: number } }) {
  const { t } = useT();
  const employeeWord = data.users === 1 ? t('overview.employeeOne') : t('overview.employeeMany');
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs muted-2">{data.users} {employeeWord}</div>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-3xl font-bold" style={{ color: scoreColor(data.avgScore) }}>{data.avgScore}%</span>
        <span className="text-xs muted-2">{t('overview.monitorAvgScoreSub', { h: data.avgActiveHours })}</span>
      </div>
    </div>
  );
}

function RankCard({ title, rows, good, onOpenUser }: {
  title: string;
  rows: { userId: string; displayName: string | null; department: string | null; score: number }[];
  good?: boolean;
  onOpenUser: (id: string) => void;
}) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {good ? <span className="text-emerald-500">▲</span> : <AlertTriangle size={14} className="text-amber-500" />} {title}
      </h3>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.userId} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-right text-sm muted-2">{i + 1}.</span>
            <button onClick={() => onOpenUser(r.userId)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">{r.displayName}</button>
            <span className="shrink-0 text-xs muted-2">{r.department}</span>
            <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: scoreColor(r.score) }}>{r.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
