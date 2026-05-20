import { useEffect, useState } from 'react';
import { api, type ScoreboardRow } from './api.js';

const C = { work: '#10b981', nonwork: '#ef4444', idle: '#cbd5e1', off: '#94a3b8' };

export function Scoreboard({ from, to, department }: { from: string; to: string; department?: string }) {
  const [rows, setRows] = useState<ScoreboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scoreboard(from, to, department).then(setRows).catch((e) => setError(String(e)));
  }, [from, to, department]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">Žebříček efektivity</h3>
      <p className="mb-4 text-xs text-gray-400">Skóre = podíl odpracovaného času z očekávaného fondu.</p>
      {error && <p className="text-sm text-red-600">Chyba: {error}</p>}
      <div className="space-y-3">
        {rows.map((r, i) => {
          const scoreColor = r.score >= 70 ? 'text-emerald-600' : r.score >= 45 ? 'text-amber-500' : 'text-red-500';
          return (
            <div key={r.userId} className="flex items-center gap-3">
              <div className="w-6 text-right text-sm font-semibold text-gray-400">{i + 1}.</div>
              <div className="w-44 shrink-0">
                <div className="text-sm font-medium text-gray-800">{r.displayName}</div>
                <div className="text-xs text-gray-400">{r.department}</div>
              </div>
              <div className="flex h-5 flex-1 overflow-hidden rounded bg-gray-100" title="práce / mimo / nečinný / mimo PC">
                <div style={{ width: `${r.workPct}%`, background: C.work }} />
                <div style={{ width: `${r.nonWorkPct}%`, background: C.nonwork }} />
                <div style={{ width: `${r.idlePct}%`, background: C.idle }} />
                <div style={{ width: `${r.pcOffPct}%`, background: C.off }} />
              </div>
              <div className={`w-14 text-right text-lg font-bold tabular-nums ${scoreColor}`}>{r.score}%</div>
            </div>
          );
        })}
        {rows.length === 0 && !error && <p className="text-sm text-gray-400">Žádná data.</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: C.work }} /> Pracoval</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: C.nonwork }} /> Mimopracovní</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: C.idle }} /> Nečinný</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: C.off }} /> Mimo PC</span>
      </div>
    </div>
  );
}
