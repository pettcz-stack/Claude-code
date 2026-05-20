import { useEffect, useState } from 'react';
import { House, Building2, ArrowDown, ArrowUp } from 'lucide-react';
import { api, type HomeOffice } from './api.js';

function scoreColor(s: number) {
  return s >= 70 ? 'text-emerald-500' : s >= 45 ? 'text-amber-500' : 'text-red-500';
}

function BigScore({ icon, label, score, sub }: { icon: React.ReactNode; label: string; score: number; sub: string }) {
  return (
    <div className="card flex flex-col items-center justify-center p-6">
      <div className="mb-1 flex items-center gap-2 text-sm muted">{icon} {label}</div>
      <div className={`text-5xl font-bold ${scoreColor(score)}`}>{score}%</div>
      <div className="mt-1 text-xs muted-2">{sub}</div>
    </div>
  );
}

export function HomeOfficeView({ from, to, department, onOpenUser }: {
  from: string; to: string; department?: string; onOpenUser: (id: string) => void;
}) {
  const [d, setD] = useState<HomeOffice | null>(null);
  useEffect(() => { api.homeOffice(from, to, department).then(setD).catch(() => setD(null)); }, [from, to, department]);
  if (!d) return <p className="muted-2">Načítám…</p>;

  const diff = d.company.hoScore - d.company.officeScore;
  const maxDept = Math.max(1, ...d.byDept.flatMap((x) => [x.hoScore, x.officeScore]));

  return (
    <div className="space-y-4">
      {/* Headline srovnání */}
      <div className="grid gap-4 md:grid-cols-3">
        <BigScore icon={<House size={16} className="text-emerald-600" />} label="Home office" score={d.company.hoScore} sub={`${d.company.hoDays} HO dnů · ${d.company.hoActiveHours} h práce`} />
        <BigScore icon={<Building2 size={16} className="text-emerald-600" />} label="V kanceláři" score={d.company.officeScore} sub={`${d.company.officeDays} dnů · ${d.company.officeActiveHours} h práce`} />
        <div className="card flex flex-col items-center justify-center p-6">
          <div className="mb-1 text-sm muted">Rozdíl HO vs. kancelář</div>
          <div className={`flex items-center gap-1 text-4xl font-bold ${diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {diff < 0 ? <ArrowDown size={28} /> : <ArrowUp size={28} />} {Math.abs(diff)} b.
          </div>
          <div className="mt-2 text-center text-xs muted-2">
            {diff < -3 ? 'Na home office se pracuje méně efektivně.' : diff > 3 ? 'Na home office se pracuje efektivněji.' : 'Efektivita HO a kanceláře je srovnatelná.'}
          </div>
        </div>
      </div>

      {/* Mimopracovní podíl */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4"><div className="text-xs uppercase muted-2">Mimopracovní podíl – Home office</div><div className="text-2xl font-bold text-red-500">{d.company.hoNonWorkPct}%</div></div>
        <div className="card p-4"><div className="text-xs uppercase muted-2">Mimopracovní podíl – Kancelář</div><div className="text-2xl font-bold">{d.company.officeNonWorkPct}%</div></div>
      </div>

      {/* Oddělení */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">HO vs. kancelář podle oddělení</h3>
        <div className="space-y-3">
          {d.byDept.map((x) => (
            <div key={x.department} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-sm">{x.department}</div>
              <div className="flex-1 space-y-1">
                <Bar label="HO" value={x.hoScore} max={maxDept} color="#10b981" />
                <Bar label="Kancelář" value={x.officeScore} max={maxDept} color="#64748b" />
              </div>
            </div>
          ))}
          {d.byDept.length === 0 && <p className="text-sm muted-2">Žádné HO dny v období.</p>}
        </div>
        <div className="mt-3 flex gap-4 text-xs muted">
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: '#10b981' }} /> Home office</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: '#64748b' }} /> Kancelář</span>
        </div>
      </div>

      {/* Per-user: největší propad na HO */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold">Zaměstnanci – efektivita na HO vs. v kanceláři</h3>
        <p className="mb-3 text-xs muted-2">Řazeno dle největšího propadu na home office.</p>
        <table className="w-full">
          <thead><tr><th className="th">Zaměstnanec</th><th className="th">Odd.</th><th className="th text-right">HO dnů</th><th className="th text-right">HO skóre</th><th className="th text-right">Kancelář</th><th className="th text-right">Rozdíl</th></tr></thead>
          <tbody>
            {d.perUser.map((u) => (
              <tr key={u.userId} className="divide-row">
                <td className="td"><button onClick={() => onOpenUser(u.userId)} className="font-medium hover:underline">{u.displayName}</button></td>
                <td className="td muted">{u.department}</td>
                <td className="td text-right tabular-nums">{u.hoDays}</td>
                <td className={`td text-right tabular-nums font-semibold ${scoreColor(u.hoScore)}`}>{u.hoScore}%</td>
                <td className="td text-right tabular-nums muted">{u.officeScore}%</td>
                <td className={`td text-right tabular-nums font-semibold ${u.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{u.diff > 0 ? '+' : ''}{u.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs muted-2">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
