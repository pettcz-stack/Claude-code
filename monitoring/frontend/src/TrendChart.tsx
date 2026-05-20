import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type TrendPoint } from './api.js';
import { shortDay } from './util.js';

export function TrendChart({ from, to, userId, department, dark }: {
  from: string;
  to: string;
  userId?: string;
  department?: string;
  dark: boolean;
}) {
  const [points, setPoints] = useState<TrendPoint[]>([]);

  useEffect(() => {
    api.trend(from, to, { userId, department }).then(setPoints).catch(() => setPoints([]));
  }, [from, to, userId, department]);

  const data = points.map((p) => ({ ...p, label: shortDay(p.date) }));
  const grid = dark ? '#334155' : '#e5e7eb';
  const axis = dark ? '#94a3b8' : '#6b7280';

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold">Trend skóre v čase</h3>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
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
            <Tooltip
              contentStyle={{
                background: dark ? '#1e293b' : '#fff',
                border: `1px solid ${grid}`,
                borderRadius: 8,
                fontSize: 12,
                color: dark ? '#e2e8f0' : '#111',
              }}
              formatter={(v) => [`${v} %`, 'Skóre']}
            />
            <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fill="url(#g)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
