import { useEffect, useState } from 'react';
import { Gauge, Clock, Wifi, ShieldAlert, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { api, type Overview } from './api.js';
import { Donut } from './Donut.js';
import { TrendChart } from './TrendChart.js';
import { HeatmapView } from './HeatmapView.js';
import { TYPE_COLORS } from './util.js';

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
  useEffect(() => { api.overview(from, to, department).then(setO).catch(() => setO(null)); }, [from, to, department]);
  if (!o) return <p className="muted-2">Načítám…</p>;

  const scoreColor = o.kpi.avgScore >= 70 ? 'text-emerald-500' : o.kpi.avgScore >= 45 ? 'text-amber-500' : 'text-red-500';
  const maxDept = Math.max(1, ...o.departments.map((d) => d.avgScore));

  return (
    <div className="space-y-4">
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
          <h3 className="mb-3 text-sm font-semibold">Skóre podle oddělení</h3>
          <div className="space-y-2">
            {o.departments.map((d) => {
              const c = d.avgScore >= 70 ? TYPE_COLORS.work : d.avgScore >= 45 ? '#f59e0b' : TYPE_COLORS.nonwork;
              return (
                <div key={d.department} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate text-sm">{d.department} <span className="muted-2">({d.users})</span></div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div className="h-full rounded-full" style={{ width: `${(d.avgScore / maxDept) * 100}%`, background: c }} />
                  </div>
                  <div className="w-12 text-right text-sm font-semibold tabular-nums">{d.avgScore}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top / Bottom */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankCard title="Nejlepší" rows={o.top} good onOpenUser={onOpenUser} />
        <RankCard title="Nejslabší" rows={o.bottom} onOpenUser={onOpenUser} />
      </div>

      <TrendChart from={from} to={to} department={department} dark={dark} />
      <HeatmapView from={from} to={to} department={department} />
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
        {rows.map((r, i) => {
          const c = r.score >= 70 ? 'text-emerald-500' : r.score >= 45 ? 'text-amber-500' : 'text-red-500';
          return (
            <div key={r.userId} className="flex items-center gap-3">
              <span className="w-5 text-right text-sm muted-2">{i + 1}.</span>
              <button onClick={() => onOpenUser(r.userId)} className="flex-1 text-left text-sm hover:underline">{r.displayName}</button>
              <span className="text-xs muted-2">{r.department}</span>
              <span className={`w-12 text-right text-sm font-semibold tabular-nums ${c}`}>{r.score}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
