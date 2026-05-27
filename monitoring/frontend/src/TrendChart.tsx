import { useEffect, useState, useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AreaChart as AreaIcon, LineChart as LineIcon, BarChart3 } from 'lucide-react';
import { api, type TrendPoint } from './api.js';
import { shortDay, dowShort, isWeekend, czHoliday } from './util.js';
import { useT } from './i18n/index.js';

type ChartType = 'area' | 'line' | 'bar';

export function TrendChart({ from, to, userId, department, dark }: {
  from: string;
  to: string;
  userId?: string;
  department?: string;
  dark: boolean;
}) {
  const { t } = useT();
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [type, setType] = useState<ChartType>(() => (localStorage.getItem('focus_chart') as ChartType) || 'area');

  useEffect(() => {
    api.trend(from, to, { userId, department }).then(setPoints).catch(() => setPoints([]));
  }, [from, to, userId, department]);

  function choose(ct: ChartType) {
    setType(ct);
    localStorage.setItem('focus_chart', ct);
  }

  const grid = dark ? '#334155' : '#e5e7eb';
  const axis = dark ? '#94a3b8' : '#6b7280';

  const ABS_TAG: Record<string, { short: string; full: string; color: string }> = useMemo(() => ({
    DOVOLENA: { short: t('trendChart.absVacation'), full: t('trendChart.absVacation'), color: '#0ea5e9' },
    NEMOC: { short: t('trendChart.absSick'), full: t('trendChart.absSick'), color: '#e11d48' },
    HOME_OFFICE: { short: t('trendChart.absHoShort'), full: t('trendChart.absHoFull'), color: '#6366f1' },
  }), [t]);

  // Dva typy "neměřitelných" dnů:
  //  1) BUDOUCNOST – dny za dneškem (ještě nebyly).
  //  2) PŘED NASAZENÍM AGENTA – dny před prvním záznamem aktivity. Když agent
  //     nikdy neběžel, není čestné to počítat jako "skóre 0 %" – uživatel by
  //     to vypadal jako úplně nepracující.
  // Detekujeme to klient-side z `points`: první den s nějakou aktivitou je
  // začátek měřeného období. Vše před ním je neměřitelné.
  const todayKey = new Date().toISOString().slice(0, 10);
  const firstActiveDate = points.find(
    (p) => p.workMinutes > 0 || p.nonWorkMinutes > 0 || p.idleMinutes > 0,
  )?.date.slice(0, 10);
  const data = points.map((p) => {
    const hol = czHoliday(p.date);
    const abs = p.absence ? ABS_TAG[p.absence] : undefined;
    const tag = hol ? t('trendChart.absHoliday') : abs?.short ?? null;
    const tagFull = hol ?? abs?.full ?? null;
    const tagColor = hol ? '#d97706' : abs?.color ?? '';
    const dayKey = p.date.slice(0, 10);
    const isFuture = dayKey > todayKey;
    const isBeforeDeployment = firstActiveDate != null && dayKey < firstActiveDate;
    const unmeasurable = isFuture || isBeforeDeployment;
    return {
      ...p,
      // Pro neměřitelné dny zahodime hodnoty – recharts vykreslí gap, ne 0.
      score: unmeasurable ? null : p.score,
      workMinutes: unmeasurable ? null : p.workMinutes,
      nonWorkMinutes: unmeasurable ? null : p.nonWorkMinutes,
      idleMinutes: unmeasurable ? null : p.idleMinutes,
      isFuture: unmeasurable,
      label: shortDay(p.date),
      dow: dowShort(p.date),
      weekend: isWeekend(p.date),
      tag, tagFull, tagColor,
    };
  });
  const byLabel = new Map(data.map((d) => [d.label, d]));

  // Vlastní popisek osy X: datum + den v týdnu + případně svátek/dovolená.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DayTick = ({ x, y, payload }: any) => {
    const e = byLabel.get(payload.value);
    if (!e) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={11} textAnchor="middle" fontSize={10} fill={e.isFuture ? '#cbd5e1' : axis} opacity={e.isFuture ? 0.55 : 1}>{e.label}</text>
        <text x={0} y={0} dy={23} textAnchor="middle" fontSize={10} fontWeight={600} fill={e.isFuture ? '#cbd5e1' : (e.weekend ? '#94a3b8' : axis)} opacity={e.isFuture ? 0.55 : 1}>{e.dow}</text>
        {e.tag && <text x={0} y={0} dy={34} textAnchor="middle" fontSize={8.5} fill={e.tagColor}>{e.tag}</text>}
      </g>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltip: any = {
    contentStyle: { background: dark ? '#1e293b' : '#fff', border: `1px solid ${grid}`, borderRadius: 8, fontSize: 12, color: dark ? '#e2e8f0' : '#111' },
    formatter: (v: number | string) => [`${v} %`, t('trendChart.scoreLabel')],
    labelFormatter: (label: string) => {
      const e = byLabel.get(label);
      return e ? `${e.label} (${e.dow})${e.tagFull ? ` · ${e.tagFull}` : ''}` : label;
    },
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('trendChart.title')}</h3>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
          {([['area', AreaIcon], ['line', LineIcon], ['bar', BarChart3]] as const).map(([ct, Icon]) => (
            <button key={ct} onClick={() => choose(ct)} title={ct}
              className={`rounded p-1.5 ${type === ct ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={DayTick} interval={0} height={48} stroke={grid} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axis }} stroke={grid} unit="%" />
              <Tooltip {...tooltip} />
              <Bar dataKey="score" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={DayTick} interval={0} height={48} stroke={grid} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axis }} stroke={grid} unit="%" />
              <Tooltip {...tooltip} />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={DayTick} interval={0} height={48} stroke={grid} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axis }} stroke={grid} unit="%" />
              <Tooltip {...tooltip} />
              <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fill="url(#g)" isAnimationActive={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
