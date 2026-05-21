import { useEffect, useState } from 'react';
import { api, type ScoreboardRow } from './api.js';
import { ScoreScaleLegend, ActivityLegend } from './Legend.js';
import { TYPE_COLORS, scoreTextClass } from './util.js';

export function Scoreboard({ from, to, department }: { from: string; to: string; department?: string }) {
  const [rows, setRows] = useState<ScoreboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scoreboard(from, to, department).then(setRows).catch((e) => setError(String(e)));
  }, [from, to, department]);

  return (
    <div className="card p-5">
      <h3 className="mb-1 text-sm font-semibold">Žebříček efektivity</h3>
      <p className="mb-3 text-xs muted-2">Skóre = podíl odpracovaného času z očekávaného fondu. Barva pruhu ukazuje, čím byl čas vyplněn.</p>
      <ScoreScaleLegend className="mb-4" />
      {error && <p className="text-sm text-red-500">Chyba: {error}</p>}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.userId} className="flex items-center gap-3">
            <div className="w-6 shrink-0 text-right text-sm font-semibold muted-2">{i + 1}.</div>
            <div className="w-44 shrink-0 min-w-0">
              <div className="truncate text-sm font-medium">{r.displayName}</div>
              <div className="truncate text-xs muted-2">{r.department}</div>
            </div>
            <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700" title="Pracoval / Mimopracovní / Nečinný / Mimo PC">
              <div style={{ width: `${r.workPct}%`, background: TYPE_COLORS.work }} />
              <div style={{ width: `${r.nonWorkPct}%`, background: TYPE_COLORS.nonwork }} />
              <div style={{ width: `${r.idlePct}%`, background: TYPE_COLORS.idle }} />
              <div style={{ width: `${r.pcOffPct}%`, background: TYPE_COLORS.off }} />
            </div>
            <div className={`w-14 shrink-0 text-right text-lg font-bold tabular-nums ${scoreTextClass(r.score)}`}>{r.score}%</div>
          </div>
        ))}
        {rows.length === 0 && !error && <p className="text-sm muted-2">Žádná data.</p>}
      </div>
      <ActivityLegend className="mt-4" />
    </div>
  );
}
