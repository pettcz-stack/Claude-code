import { useEffect, useState } from 'react';
import { Boxes, KeyRound, Wallet, Save } from 'lucide-react';
import { api, type SoftwareAudit, type SoftwareItem } from './api.js';

export function SoftwareView({ from, to, department, canEdit }: { from: string; to: string; department?: string; canEdit: boolean }) {
  const [data, setData] = useState<SoftwareAudit | null>(null);
  const [edit, setEdit] = useState<Record<string, { licensed: boolean; seats: string; cost: string }>>({});

  function load() {
    api.software(from, to, department).then((d) => {
      setData(d);
      const e: typeof edit = {};
      for (const i of d.items) e[i.app] = { licensed: i.licensed, seats: i.seats != null ? String(i.seats) : '', cost: i.costPerSeat != null ? String(i.costPerSeat) : '' };
      setEdit(e);
    }).catch(() => setData(null));
  }
  useEffect(load, [from, to, department]);
  if (!data) return <p className="muted-2">Načítám…</p>;

  async function saveLicense(it: SoftwareItem) {
    const e = edit[it.app];
    await api.saveCategory({
      appName: it.app,
      category: it.category ?? 'Ostatní',
      type: it.type,
      licensed: e.licensed,
      seats: e.seats ? Number(e.seats) : null,
      costPerSeat: e.cost ? Number(e.cost) : null,
    }).catch(() => undefined);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase muted-2"><Wallet size={13} /> Měsíční plýtvání licencemi</div>
          <div className="text-3xl font-bold text-red-500">{data.totalWasteCost.toLocaleString('cs-CZ')} Kč</div>
          <div className="text-xs muted-2">nevyužité placené licence</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase muted-2"><Wallet size={13} /> Ročně</div>
          <div className="text-3xl font-bold text-red-500">{(data.totalWasteCost * 12).toLocaleString('cs-CZ')} Kč</div>
          <div className="text-xs muted-2">potenciální úspora za rok</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase muted-2"><Boxes size={13} /> Sledováno</div>
          <div className="text-3xl font-bold">{data.workforce}</div>
          <div className="text-xs muted-2">zaměstnanců</div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} className="text-emerald-600" /> Audit softwaru a licencí</h3>
        <p className="mb-3 text-xs muted-2">Reálné využití aplikací. U placených aplikací vidíte, kolik licencí leží ladem.</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Aplikace</th><th className="th">Kategorie</th>
                <th className="th text-right">Hodin</th><th className="th text-right">Uživatelů</th>
                <th className="th">Placená</th><th className="th text-right">Licencí</th>
                <th className="th text-right">Cena/lic.</th><th className="th text-right">Využití</th>
                <th className="th text-right">Plýtvání/měs.</th>{canEdit && <th className="th"></th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => {
                const e = edit[i.app] ?? { licensed: false, seats: '', cost: '' };
                const util = i.utilizationPct;
                const utilColor = util == null ? '' : util >= 80 ? 'text-emerald-500' : util >= 40 ? 'text-amber-500' : 'text-red-500';
                return (
                  <tr key={i.app} className="divide-row">
                    <td className="td font-mono text-xs">{i.app}</td>
                    <td className="td muted">{i.category ?? '—'}</td>
                    <td className="td text-right tabular-nums">{i.activeHours}</td>
                    <td className="td text-right tabular-nums">{i.users} <span className="muted-2">({i.usersPct}%)</span></td>
                    {canEdit ? (
                      <>
                        <td className="td"><input type="checkbox" checked={e.licensed} onChange={(ev) => setEdit({ ...edit, [i.app]: { ...e, licensed: ev.target.checked } })} /></td>
                        <td className="td"><input value={e.seats} onChange={(ev) => setEdit({ ...edit, [i.app]: { ...e, seats: ev.target.value } })} className="field w-16 text-right" /></td>
                        <td className="td"><input value={e.cost} onChange={(ev) => setEdit({ ...edit, [i.app]: { ...e, cost: ev.target.value } })} className="field w-20 text-right" /></td>
                      </>
                    ) : (
                      <>
                        <td className="td">{i.licensed ? 'ano' : '—'}</td>
                        <td className="td text-right tabular-nums">{i.seats ?? '—'}</td>
                        <td className="td text-right tabular-nums">{i.costPerSeat != null ? `${i.costPerSeat} Kč` : '—'}</td>
                      </>
                    )}
                    <td className={`td text-right tabular-nums font-semibold ${utilColor}`}>{util != null ? `${util}%` : '—'}</td>
                    <td className="td text-right tabular-nums font-semibold text-red-500">{i.wasteCost ? `${i.wasteCost.toLocaleString('cs-CZ')} Kč` : '—'}</td>
                    {canEdit && <td className="td text-right"><button onClick={() => saveLicense(i)} className="btn-ghost px-2"><Save size={14} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs muted-2">Tip: u aplikace nad 100 % využití (víc uživatelů než licencí) je naopak potřeba licence dokoupit.</p>
      </div>
    </div>
  );
}
