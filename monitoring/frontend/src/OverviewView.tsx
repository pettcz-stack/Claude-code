import { useEffect, useState } from 'react';
import { Gauge, Clock, Wifi, ShieldAlert, AlertTriangle, ArrowUp, ArrowDown, Minus, Monitor, Lightbulb } from 'lucide-react';
import { api, type Overview, type MonitorsData } from './api.js';
import { Donut } from './Donut.js';
import { TrendChart } from './TrendChart.js';
import { HeatmapView } from './HeatmapView.js';
import { PageSkeleton } from './Skeleton.js';
import { ScoreScaleLegend } from './Legend.js';
import { TYPE_COLORS, scoreHex, scoreTextClass } from './util.js';

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide muted-2">{icon} {label}</div>
      <div className={`text-2xl font-bold ${accent ?? ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="muted-2 flex items-center gap-0.5"><Minus size={12} /> bez srovnání</span>;
  if (d === 0) return <span className="muted-2 flex items-center gap-0.5"><Minus size={12} /> beze změny</span>;
  const up = d > 0;
  return (
    <span className={`flex items-center gap-0.5 ${up ? 'text-emerald-500' : 'text-red-500'}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {up ? '+' : ''}{d} b. vs minulé období
    </span>
  );
}

export function OverviewView({ from, to, department, dark, onOpenUser }: {
  from: string; to: string; department?: string; dark: boolean; onOpenUser: (id: string) => void;
}) {
  const [o, setO] = useState<Overview | null>(null);
  const [mon, setMon] = useState<MonitorsData | null>(null);
  useEffect(() => { api.overview(from, to, department).then(setO).catch(() => setO(null)); }, [from, to, department]);
  useEffect(() => { api.monitors(from, to, department).then(setMon).catch(() => setMon(null)); }, [from, to, department]);
  if (!o) return <PageSkeleton />;

  const scoreColor = scoreTextClass(o.kpi.avgScore);

  return (
    <div className="space-y-4">
      <ScoreScaleLegend />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Gauge size={13} />} label="Průměrné skóre" value={`${o.kpi.avgScore} %`} accent={scoreColor} sub={<Delta d={o.kpi.avgScoreDelta} />} />
        <Kpi icon={<Clock size={13} />} label="Aktivní práce" value={`${o.kpi.activeHours} h`} sub={<span className="muted-2">{o.kpi.userCount} sledovaných</span>} />
        <Kpi icon={<Wifi size={13} />} label="Online teď" value={`${o.kpi.onlineCount}`} sub={<span className="muted-2">z {o.kpi.userCount} zařízení</span>} />
        <Kpi icon={<ShieldAlert size={13} />} label="Upozornění" value={`${o.kpi.flaggedCount}`} accent={o.kpi.flaggedCount ? 'text-red-500' : ''} sub={<span className="muted-2">podezřelé chování</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rozdělení času */}
        <div className="card flex flex-col items-center justify-center p-6">
          <h3 className="mb-3 self-start text-sm font-semibold">Rozdělení času (firma)</h3>
          <Donut
            size={170}
            segments={[
              { value: o.split.work, color: TYPE_COLORS.work },
              { value: o.split.nonwork, color: TYPE_COLORS.nonwork },
              { value: o.split.idle, color: TYPE_COLORS.idle },
              { value: o.split.pcoff, color: TYPE_COLORS.off },
            ]}
            center={<><div className="text-xl font-bold">{o.split.work} h</div><div className="text-xs muted-2">práce</div></>}
          />
          <div className="mt-3 grid w-full grid-cols-2 gap-1 text-xs">
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.work }} /> Práce {o.split.work} h</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.nonwork }} /> Mimo {o.split.nonwork} h</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.idle }} /> Nečinnost {o.split.idle} h</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLORS.off }} /> Mimo PC {o.split.pcoff} h</span>
          </div>
        </div>

        {/* Srovnání oddělení */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold">Skóre podle oddělení</h3>
          <p className="mb-3 text-xs muted-2">Délka i barva pruhu odpovídají skóre (0–100 %). Číslo v závorce = počet lidí.</p>
          <div className="space-y-2.5">
            {o.departments.map((d) => (
              <div key={d.department} className="flex items-center gap-3">
                <div className="w-44 shrink-0 truncate text-sm" title={d.department}>{d.department} <span className="muted-2">({d.users})</span></div>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.avgScore}%`, background: scoreHex(d.avgScore) }} />
                </div>
                <div className={`w-12 text-right text-sm font-bold tabular-nums ${scoreTextClass(d.avgScore)}`}>{d.avgScore}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top / Bottom */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankCard title="Nejlepší" rows={o.top} good onOpenUser={onOpenUser} />
        <RankCard title="Nejslabší" rows={o.bottom} onOpenUser={onOpenUser} />
      </div>

      {/* Efektivita podle počtu monitorů */}
      {mon && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Monitor size={16} className="text-emerald-600" /> Efektivita podle počtu monitorů</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <MonitorBox label="1 monitor" data={mon.single} />
            <MonitorBox label="2+ monitory" data={mon.multi} />
          </div>
          <p className="mt-3 text-xs muted-2">
            Sledujeme pouze počet připojených monitorů (HW), nikoli obsah druhé obrazovky.
          </p>
        </div>
      )}

      {/* Manažerská doporučení (interpretace dat – nezasahuje do nich) */}
      {mon && mon.advice.candidates.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} className="text-amber-500" /> Manažerská doporučení</h3>
          <p className="mb-3 text-xs muted-2">
            Návrhy odvozené z dat (nezasahují do nich). Druhý monitor u níže uvedených lidí dělá práci,
            které dle studií přináší +{mon.advice.upliftLowPct}–{mon.advice.upliftHighPct} % – vyplatí se ho zvážit.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Zaměstnanec</th><th className="th">Odd.</th>
                  <th className="th">Typ práce</th><th className="th text-right">Monitorů</th>
                  <th className="th text-right">Odpracováno</th><th className="th text-right">Možný přínos</th>
                </tr>
              </thead>
              <tbody>
                {mon.advice.candidates.map((c) => (
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
          <p className="mt-3 text-xs muted-2">
            „Možný přínos" = orientační rozsah produktivnějších hodin za období, pokud by člověk dostal druhý monitor.
            Jde o odhad ze studií, ne o naměřená data.
          </p>
        </div>
      )}

      <TrendChart from={from} to={to} department={department} dark={dark} />
      <HeatmapView from={from} to={to} department={department} />
    </div>
  );
}

function MonitorBox({ label, data }: { label: string; data: { users: number; avgScore: number; avgActiveHours: number } }) {
  const c = scoreTextClass(data.avgScore);
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs muted-2">{data.users} {data.users === 1 ? 'zaměstnanec' : 'zaměstnanců'}</div>
      <div className="mt-2 flex items-end gap-3">
        <span className={`text-3xl font-bold ${c}`}>{data.avgScore}%</span>
        <span className="text-xs muted-2">prům. skóre · {data.avgActiveHours} h práce</span>
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
            <span className={`w-12 shrink-0 text-right text-sm font-bold tabular-nums ${scoreTextClass(r.score)}`}>{r.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
