import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileDown } from 'lucide-react';
import { api, type SummaryRow } from './api.js';
import { minutesToHm } from './util.js';

type Props = { from: string; to: string; department?: string };

export function SummaryView({ from, to, department }: Props) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.summary(from, to, department)
      .then((r) => setRows([...r].sort((a, b) => b.activeMinutes - a.activeMinutes)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [from, to, department]);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => api.exportHourly(from, to, { department }).catch((e) => setError(String(e)))} className="btn-primary">
          <FileSpreadsheet size={15} /> Export do Excelu
        </button>
        <button onClick={() => api.exportIntervals(from, to).catch((e) => setError(String(e)))} className="btn-ghost">
          <FileDown size={15} /> Surová data
        </button>
        {loading && <span className="text-sm text-blue-500">Načítám…</span>}
        {error && <span className="text-sm text-red-500">Chyba: {error}</span>}
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Zaměstnanec</th><th className="th">Oddělení</th>
            <th className="th text-right">Aktivní</th><th className="th text-right">Nečinnost</th>
            <th className="th text-right">Zamčeno</th><th className="th text-right">Úhozy/min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="divide-row">
              <td className="td font-medium">{r.displayName ?? r.userId}</td>
              <td className="td muted">{r.department ?? '—'}</td>
              <td className="td text-right tabular-nums text-emerald-500">{minutesToHm(r.activeMinutes)}</td>
              <td className="td text-right tabular-nums muted">{minutesToHm(r.idleMinutes)}</td>
              <td className="td text-right tabular-nums muted-2">{minutesToHm(r.lockedMinutes)}</td>
              <td className="td text-right tabular-nums">{r.avgKpm}</td>
            </tr>
          ))}
          {rows.length === 0 && !loading && <tr><td colSpan={6} className="td py-6 text-center muted-2">Žádná data pro zvolené období.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
