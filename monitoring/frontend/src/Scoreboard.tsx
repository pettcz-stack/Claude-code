import { useEffect, useState } from 'react';
import { api, type ScoreboardRow } from './api.js';
import { TYPE_COLORS } from './util.js';

export function Scoreboard({ from, to, department }: { from: string; to: string; department?: string }) {
  const [rows, setRows] = useState<ScoreboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scoreboard(from, to, department).then(setRows).catch((e) => setError(String(e)));
  }, [from, to, department]);

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold">Žebříček efektivity</h3>
      <p className="mb-4 text-xs muted-2">Skóre = podíl odpracovaného času z očekávaného fondu.</p>
      {error && <p className="text-sm text-red-500">Chyba: {error}</p>}
      <div className="space-y-3">
        {rows.map((r, i) => {
          const scoreColor = r.score >= 70 ? 'text-emerald-500' : r.score >= 45 ? 'text-amber-500' : 'text-red-500';
          return (
            <div key={r.userId} className="flex items-center gap-3">
              <div className="w-6 text-right text-sm font-semibold muted-2">{i + 1}.</div>
              <div className="w-44 shrink-0">
                <div className="text-sm font-medium">{r.displayName}</div>
                <div className="text-xs muted-2">{r.department}</div>
              </div>
              <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700" title="práce / mimo / nečinný / mimo PC">
                <div style={{ width: `${r.workPct}%`, background: TYPE_COLORS.work }} />
                <div style={{ width: `${r.nonWorkPct}%`, background: TYPE_COLORS.nonwork }} />
                <div style={{ width: `${r.idlePct}%`, background: TYPE_COLORS.idle }} />
                <div style={{ width: `${r.pcOffPct}%`, background: TYPE_COLORS.off }} />
              </div>
              <div className={`w-14 text-right text-lg font-bold tabular-nums ${scoreColor}`}>{r.score}%</div>
            </div>
          );
        })}
        {rows.length === 0 && !error && <p className="text-sm muted-2">Žádná data.</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs muted">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.work }} /> Pracoval</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.nonwork }} /> Mimopracovní</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.idle }} /> Nečinný</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLORS.off }} /> Mimo PC</span>
      </div>
    </div>
  );
}
