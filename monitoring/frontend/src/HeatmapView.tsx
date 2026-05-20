import { useEffect, useState } from 'react';
import { api, type Heatmap as HeatmapData } from './api.js';

const DAYS = [
  { idx: 1, label: 'Po' }, { idx: 2, label: 'Út' }, { idx: 3, label: 'St' },
  { idx: 4, label: 'Čt' }, { idx: 5, label: 'Pá' }, { idx: 6, label: 'So' }, { idx: 0, label: 'Ne' },
];

export function HeatmapView({ from, to, department, userId }: { from: string; to: string; department?: string; userId?: string }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  useEffect(() => { api.heatmap(from, to, { department, userId }).then(setData).catch(() => setData(null)); }, [from, to, department, userId]);
  if (!data) return null;
  const max = Math.max(data.max, 1);

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold">Kdy se pracuje (vytížení dne)</h3>
      <p className="mb-3 text-xs muted-2">Průměrná aktivita podle dne v týdnu a hodiny. Tmavší = více práce.</p>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="text-[10px] font-normal muted-2" style={{ width: 22 }}>{h % 3 === 0 ? h : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.idx}>
                <td className="pr-2 text-right text-xs muted">{d.label}</td>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = data.matrix[d.idx]?.[h] ?? 0;
                  const a = v / max;
                  return (
                    <td key={h} title={`${d.label} ${h}:00 — ${v} min`}
                      style={{
                        width: 20, height: 18, borderRadius: 3,
                        background: a === 0 ? 'rgba(148,163,184,0.12)' : `rgba(16,185,129,${0.12 + 0.88 * a})`,
                      }} />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
