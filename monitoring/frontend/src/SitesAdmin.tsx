import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Building2 } from 'lucide-react';
import { api, type Site } from './api.js';
import { useToast } from './Toast.js';

export function SitesAdmin({ canEdit }: { canEdit: boolean }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState('');
  const [subnets, setSubnets] = useState('');
  const toast = useToast();

  function load() { api.sites().then(setSites).catch(() => setSites([])); }
  useEffect(load, []);

  async function add() {
    if (!name.trim() || !subnets.trim()) { toast('Vyplň název i podsítě', 'error'); return; }
    try {
      await api.saveSite({ name: name.trim(), subnets: subnets.trim() });
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
            <th className="th">Síťové rozsahy (CIDR, odděl čárkou)</th>
            <th className="th text-center">Aktivní</th>
            {canEdit && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="divide-row">
                <td className="td font-medium"><span className="flex items-center gap-2"><Building2 size={15} className="text-sky-500" /> {s.name}</span></td>
                <td className="td font-mono text-xs muted">{s.subnets}</td>
                <td className="td text-center">{s.active ? 'ano' : '—'}</td>
                {canEdit && <td className="td text-right"><button onClick={() => remove(s.id)} className="btn-ghost px-2 text-red-500" title="Smazat"><Trash2 size={14} /></button></td>}
              </tr>
            ))}
            {sites.length === 0 && <tr><td className="td muted-2" colSpan={canEdit ? 4 : 3}>Zatím žádné provozovny. Vše se vyhodnotí jako „Mimo firmu".</td></tr>}
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
            <label className="mb-1 block text-xs muted">Síťové rozsahy (CIDR)</label>
            <input value={subnets} onChange={(e) => setSubnets(e.target.value)} placeholder="např. 10.30.0.0/16, 10.31.0.0/16" className="field w-72" />
          </div>
          <button onClick={add} className="btn-primary"><Plus size={15} /> Přidat provozovnu</button>
        </div>
      )}
      <p className="mt-3 text-xs muted-2">Tip: rozsahy zjistíš u IT (podsíť dané pobočky, např. <code>10.30.0.0/16</code>). Co nesedí do žádné provozovny = „Mimo firmu".</p>
    </div>
  );
}
