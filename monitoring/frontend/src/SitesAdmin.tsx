import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Building2 } from 'lucide-react';
import { api, type Site } from './api.js';
import { useToast } from './Toast.js';

export function SitesAdmin({ canEdit }: { canEdit: boolean }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState('');
  const [subnets, setSubnets] = useState('');
  const [kind, setKind] = useState('VLASTNI');
  const toast = useToast();

  function load() { api.sites().then(setSites).catch(() => setSites([])); }
  useEffect(load, []);

  async function add() {
    if (!name.trim()) { toast('Vyplň název provozovny', 'error'); return; }
    try {
      await api.saveSite({ name: name.trim(), subnets: subnets.trim(), kind });
      setName(''); setSubnets(''); toast('Provozovna přidána'); load();
    } catch { toast('Uložení selhalo', 'error'); }
  }
  async function remove(id: string) {
    try { await api.deleteSite(id); toast('Provozovna smazána'); load(); } catch { toast('Smazání selhalo', 'error'); }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-sky-500" /> Identifikace provozoven (pracoviště podle sítě)</h3>
      <p className="mb-4 text-xs muted-2">
        Pracoviště se určuje podle <b>lokální (privátní) sítě</b>, do které je počítač připojený – ne podle veřejné IP.
        Díky tomu se <b>Home Office přes VPN nezobrazí jako pobočka</b> (PC má doma vlastní podsíť → „Mimo firmu").
        Zadej u každé provozovny její IP rozsahy (CIDR), oddělené čárkou.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">Provozovna / pobočka / závod</th>
            <th className="th">Typ</th>
            <th className="th">Síťové rozsahy (CIDR, odděl čárkou)</th>
            <th className="th text-center">Měřitelné</th>
            {canEdit && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {sites.map((s) => {
              const measurable = s.active && s.subnets.trim().length > 0;
              return (
                <tr key={s.id} className="divide-row">
                  <td className="td font-medium"><span className="flex items-center gap-2"><Building2 size={15} className={s.kind === 'PARTNER' ? 'text-amber-500' : 'text-sky-500'} /> {s.name}</span></td>
                  <td className="td">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.kind === 'PARTNER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'}`}>{s.kind === 'PARTNER' ? 'partner' : 'vlastní'}</span>
                  </td>
                  <td className="td font-mono text-xs muted">{s.subnets.trim() || <span className="not-italic text-amber-600 dark:text-amber-400">rozsah zatím nezadán</span>}</td>
                  <td className="td text-center">{measurable ? 'ano' : <span className="muted-2">zatím ne</span>}</td>
                  {canEdit && <td className="td text-right"><button onClick={() => remove(s.id)} className="btn-ghost px-2 text-red-500" title="Smazat"><Trash2 size={14} /></button></td>}
                </tr>
              );
            })}
            {sites.length === 0 && <tr><td className="td muted-2" colSpan={canEdit ? 5 : 4}>Zatím žádné provozovny. Vše se vyhodnotí jako „Mimo firmu".</td></tr>}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs muted">Název provozovny</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Areál Hořovice" className="field w-56" />
          </div>
          <div>
            <label className="mb-1 block text-xs muted">Typ</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="field w-32">
              <option value="VLASTNI">vlastní</option>
              <option value="PARTNER">partner</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs muted">Síťové rozsahy (CIDR) – u partnerů lze nechat prázdné</label>
            <input value={subnets} onChange={(e) => setSubnets(e.target.value)} placeholder="např. 10.30.0.0/16, 10.31.0.0/16" className="field w-72" />
          </div>
          <button onClick={add} className="btn-primary"><Plus size={15} /> Přidat provozovnu</button>
        </div>
      )}
      <p className="mt-3 text-xs muted-2">Tip: rozsahy zjistíš u IT (podsíť dané pobočky, např. <code>10.30.0.0/16</code>). Co nesedí do žádné provozovny = „Mimo firmu". <b>Partnerské pobočky</b> bez zadaného rozsahu jsou v evidenci, ale dokud IT nepotvrdí podsíť, nejsou měřitelné (zobrazí se jako „Mimo firmu").</p>
    </div>
  );
}
