import { useEffect, useState } from 'react';
import { Boxes, KeyRound, Wallet, Save, Coins, AlertTriangle } from 'lucide-react';
import { api, type SoftwareAudit, type SoftwareItem, type CostResult } from './api.js';
import { PageSkeleton } from './Skeleton.js';
import { useToast } from './Toast.js';
import { AppIcon, appName } from './appMeta.js';

export function SoftwareView({ from, to, department, canEdit }: { from: string; to: string; department?: string; canEdit: boolean }) {
  const [data, setData] = useState<SoftwareAudit | null>(null);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [edit, setEdit] = useState<Record<string, { licensed: boolean; seats: string; cost: string }>>({});
  const toast = useToast();

  function load() {
    api.software(from, to, department).then((d) => {
      setData(d);
      const e: typeof edit = {};
      for (const i of d.items) e[i.app] = { licensed: i.licensed, seats: i.seats != null ? String(i.seats) : '', cost: i.costPerSeat != null ? String(i.costPerSeat) : '' };
      setEdit(e);
    }).catch(() => setData(null));
    // Mzdy a cena času jsou citlivé → jen pro admina (šéfa).
    if (canEdit) api.cost(from, to, department).then(setCost).catch(() => setCost(null));
  }
  useEffect(load, [from, to, department]);
  if (!data) return <PageSkeleton kpi={3} />;

  async function saveLicense(it: SoftwareItem) {
    const e = edit[it.app];
    await api.saveCategory({
      appName: it.app,
      category: it.category ?? 'Ostatní',
      type: it.type,
      licensed: e.licensed,
      seats: e.seats ? Number(e.seats) : null,
      costPerSeat: e.cost ? Number(e.cost) : null,
    }).then(() => toast(`Uloženo: ${it.app}`)).catch(() => toast('Uložení selhalo', 'error'));
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

      {/* Náklady neproduktivního času */}
      {cost && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Coins size={16} className="text-red-500" /> Cena neproduktivního času</h3>
          <p className="mb-3 text-xs muted-2">Kolik stojí čas, kdy se nepracuje (mzda × neproduktivní hodiny). {cost.withRate}/{cost.workforce} lidí má zadanou mzdu.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <CostCard label="Mimopráce (soc. sítě, hry…)" value={cost.totals.nonworkCost} />
            <CostCard label="Nečinnost u PC" value={cost.totals.idleCost} />
            <CostCard label="Mimo PC v prac. době" value={cost.totals.pcoffCost} />
            <CostCard label="Celkem za období" value={cost.totals.wastedCost} big />
          </div>
          {cost.totals.wastedCost === 0 && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={14} /> Zadej mzdy zaměstnanců ve „Správa", aby se cena spočítala.
            </p>
          )}
          <table className="w-full">
            <thead><tr><th className="th">Zaměstnanec</th><th className="th">Odd.</th><th className="th text-right">Mzda/h</th><th className="th text-right">Mimopráce</th><th className="th text-right">Nečinnost</th><th className="th text-right">Mimo PC</th><th className="th text-right">Stálo nás</th></tr></thead>
            <tbody>
              {cost.perUser.slice(0, 10).map((u) => (
                <tr key={u.userId} className="divide-row">
                  <td className="td font-medium">{u.displayName}</td>
                  <td className="td muted">{u.department}</td>
                  <td className="td text-right tabular-nums muted">{u.hourlyRate != null ? `${u.hourlyRate} Kč` : '—'}</td>
                  <td className="td text-right tabular-nums">{u.nonworkHours} h</td>
                  <td className="td text-right tabular-nums">{u.idleHours} h</td>
                  <td className="td text-right tabular-nums">{u.pcoffHours} h</td>
                  <td className="td text-right tabular-nums font-semibold text-red-500">{u.wastedCost != null ? `${u.wastedCost.toLocaleString('cs-CZ')} Kč` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} className="text-emerald-600" /> Audit softwaru a licencí</h3>
        <p className="mb-2 text-xs muted-2">Reálné využití aplikací. U placených aplikací vidíte, kolik licencí leží ladem.</p>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="font-semibold">Sloupec „Využití":</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> 80–100 % dobře využité</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-amber-500" /> 40–79 % částečně</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-red-500" /> 0–39 % plýtvání</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Aplikace</th><th className="th">Kategorie</th>
                <th className="th text-right">Hodin</th><th className="th text-right">Uživatelů</th>
                <th className="th text-center">Placená</th><th className="th text-right">Licencí</th>
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
                    <td className="td"><span className="flex items-center gap-2"><AppIcon app={i.app} size={15} /> <span className="font-medium">{appName(i.app)}</span></span></td>
                    <td className="td muted">{i.category ?? '—'}</td>
                    <td className="td text-right tabular-nums">{i.activeHours}</td>
                    <td className="td text-right tabular-nums">{i.users} <span className="muted-2">({i.usersPct}%)</span></td>
                    {canEdit ? (
                      <>
                        <td className="td text-center"><input type="checkbox" checked={e.licensed} onChange={(ev) => setEdit({ ...edit, [i.app]: { ...e, licensed: ev.target.checked } })} /></td>
                        <td className="td text-right"><input value={e.seats} onChange={(ev) => setEdit({ ...edit, [i.app]: { ...e, seats: ev.target.value } })} className="field w-16 text-right" /></td>
                        <td className="td text-right"><input value={e.cost} onChange={(ev) => setEdit({ ...edit, [i.app]: { ...e, cost: ev.target.value } })} className="field w-20 text-right" /></td>
                      </>
                    ) : (
                      <>
                        <td className="td text-center">{i.licensed ? 'ano' : '—'}</td>
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

function CostCard({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${big ? 'border-red-300 dark:border-red-500/40' : 'border-gray-200 dark:border-slate-700'}`}>
      <div className="text-xs uppercase muted-2">{label}</div>
      <div className={`font-bold ${big ? 'text-2xl text-red-500' : 'text-xl'}`}>{value.toLocaleString('cs-CZ')} Kč</div>
    </div>
  );
}
