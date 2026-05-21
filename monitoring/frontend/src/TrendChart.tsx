import { useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AreaChart as AreaIcon, LineChart as LineIcon, BarChart3 } from 'lucide-react';
import { api, type TrendPoint } from './api.js';
import { shortDay } from './util.js';

type ChartType = 'area' | 'line' | 'bar';

export function TrendChart({ from, to, userId, department, dark }: {
  from: string;
  to: string;
  userId?: string;
  department?: string;
  dark: boolean;
}) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [type, setType] = useState<ChartType>(() => (localStorage.getItem('workview_chart') as ChartType) || 'area');

  useEffect(() => {
    api.trend(from, to, { userId, department }).then(setPoints).catch(() => setPoints([]));
  }, [from, to, userId, department]);

  function choose(t: ChartType) {
    setType(t);
    localStorage.setItem('workview_chart', t);
  }

  const data = points.map((p) => ({ ...p, label: shortDay(p.date) }));
  const grid = dark ? '#334155' : '#e5e7eb';
  const axis = dark ? '#94a3b8' : '#6b7280';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltip: any = {
    contentStyle: { background: dark ? '#1e293b' : '#fff', border: `1px solid ${grid}`, borderRadius: 8, fontSize: 12, color: dark ? '#e2e8f0' : '#111' },
    formatter: (v: number | string) => [`${v} %`, 'Skóre'],
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Trend skóre v čase</h3>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
          {([['area', AreaIcon], ['line', LineIcon], ['bar', BarChart3]] as const).map(([t, Icon]) => (
            <button key={t} onClick={() => choose(t)} title={t}
              className={`rounded p-1.5 ${type === t ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>
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
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: axis }} stroke={grid} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axis }} stroke={grid} unit="%" />
              <Tooltip {...tooltip} />
              <Bar dataKey="score" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: axis }} stroke={grid} />
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
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: axis }} stroke={grid} />
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
