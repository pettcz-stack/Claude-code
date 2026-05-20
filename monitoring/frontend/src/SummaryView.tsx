import { useEffect, useState } from 'react';
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
    api
      .summary(from, to, department)
      .then((r) => setRows([...r].sort((a, b) => b.activeMinutes - a.activeMinutes)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [from, to, department]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <a
          href={api.exportHourlyUrl(from, to, { department })}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Export do Excelu (hodinová data)
        </a>
        <a
          href={api.exportIntervalsUrl(from, to)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export syrových intervalů
        </a>
        {loading && <span className="text-sm text-blue-600">Načítám…</span>}
        {error && <span className="text-sm text-red-600">Chyba: {error}</span>}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">Zaměstnanec</th>
              <th className="px-3 py-2">Oddělení</th>
              <th className="px-3 py-2 text-right">Aktivní</th>
              <th className="px-3 py-2 text-right">Nečinnost</th>
              <th className="px-3 py-2 text-right">Zamčeno</th>
              <th className="px-3 py-2 text-right">Prům. úhozy/min</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-800">{r.displayName ?? r.userId}</td>
                <td className="px-3 py-2 text-gray-500">{r.department ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{minutesToHm(r.activeMinutes)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">{minutesToHm(r.idleMinutes)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500">{minutesToHm(r.lockedMinutes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.avgKpm}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Žádná data pro zvolené období.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
