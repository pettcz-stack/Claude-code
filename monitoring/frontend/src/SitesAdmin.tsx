import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Building2, Pencil, Check, X } from 'lucide-react';
import { api, type Site } from './api.js';
import { useToast } from './Toast.js';
import { useT } from './i18n/index.js';

export function SitesAdmin({ canEdit }: { canEdit: boolean }) {
  const { t } = useT();
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState('');
  const [subnets, setSubnets] = useState('');
  const [kind, setKind] = useState('VLASTNI');
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ name: string; subnets: string; kind: string; active: boolean }>({ name: '', subnets: '', kind: 'VLASTNI', active: true });
  const toast = useToast();

  function load() { api.sites().then(setSites).catch(() => setSites([])); }
  useEffect(load, []);

  async function add() {
    if (!name.trim()) { toast(t('sitesAdmin.nameRequired'), 'error'); return; }
    try {
      await api.saveSite({ name: name.trim(), subnets: subnets.trim(), kind });
      setName(''); setSubnets(''); toast(t('sitesAdmin.addedToast')); load();
    } catch { toast(t('sitesAdmin.saveFailed'), 'error'); }
  }
  function startEdit(s: Site) { setEditId(s.id); setEdit({ name: s.name, subnets: s.subnets, kind: s.kind, active: s.active }); }
  async function saveEdit(id: string) {
    if (!edit.name.trim()) { toast(t('sitesAdmin.nameEmpty'), 'error'); return; }
    try {
      await api.updateSite(id, { name: edit.name.trim(), subnets: edit.subnets.trim(), kind: edit.kind, active: edit.active });
      setEditId(null); toast(t('sitesAdmin.savedToast')); load();
    } catch { toast(t('sitesAdmin.saveFailed'), 'error'); }
  }
  async function remove(id: string) {
    try { await api.deleteSite(id); toast(t('sitesAdmin.deletedToast')); load(); } catch { toast(t('sitesAdmin.deleteFailed'), 'error'); }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-sky-500" /> {t('sitesAdmin.title')}</h3>
      <p className="mb-4 text-xs muted-2">
        {t('sitesAdmin.introLine1')}<b>{t('sitesAdmin.introLocalNetwork')}</b>{t('sitesAdmin.introLine2')}<b>{t('sitesAdmin.introVpnEmphasis')}</b>{t('sitesAdmin.introLine3')}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr>
            <th className="th">{t('sitesAdmin.colName')}</th>
            <th className="th">{t('sitesAdmin.colKind')}</th>
            <th className="th">{t('sitesAdmin.colSubnets')}</th>
            <th className="th text-center">{t('sitesAdmin.colMeasurable')}</th>
            {canEdit && <th className="th text-right"></th>}
          </tr></thead>
          <tbody>
            {sites.map((s) => {
              const measurable = s.active && s.subnets.trim().length > 0;
              if (editId === s.id) {
                return (
                  <tr key={s.id} className="divide-row bg-gray-50 dark:bg-slate-800/40">
                    <td className="td"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="field w-48" /></td>
                    <td className="td"><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} className="field w-28"><option value="VLASTNI">{t('sitesAdmin.kindOwn')}</option><option value="PARTNER">{t('sitesAdmin.kindPartner')}</option></select></td>
                    <td className="td"><input value={edit.subnets} onChange={(e) => setEdit({ ...edit, subnets: e.target.value })} placeholder={t('sitesAdmin.subnetsRowPlaceholder')} className="field w-60 font-mono text-xs" /></td>
                    <td className="td text-center"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /></td>
                    <td className="td text-right">
                      <button onClick={() => saveEdit(s.id)} className="btn-ghost px-2 text-emerald-600" title={t('sitesAdmin.titleSave')}><Check size={15} /></button>
                      <button onClick={() => setEditId(null)} className="btn-ghost px-2" title={t('sitesAdmin.titleCancel')}><X size={15} /></button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={s.id} className="divide-row">
                  <td className="td font-medium"><span className="flex items-center gap-2"><Building2 size={15} className={s.kind === 'PARTNER' ? 'text-amber-500' : 'text-sky-500'} /> {s.name}</span></td>
                  <td className="td">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.kind === 'PARTNER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'}`}>{s.kind === 'PARTNER' ? t('sitesAdmin.kindPartner') : t('sitesAdmin.kindOwn')}</span>
                  </td>
                  <td className="td font-mono text-xs muted">{s.subnets.trim() || <span className="not-italic text-amber-600 dark:text-amber-400">{t('sitesAdmin.noSubnet')}</span>}</td>
                  <td className="td text-center">{measurable ? t('sitesAdmin.yes') : <span className="muted-2">{t('sitesAdmin.notYet')}</span>}</td>
                  {canEdit && (
                    <td className="td text-right whitespace-nowrap">
                      <button onClick={() => startEdit(s)} className="btn-ghost px-2" title={t('sitesAdmin.titleEdit')}><Pencil size={14} /></button>
                      <button onClick={() => remove(s.id)} className="btn-ghost px-2 text-red-500" title={t('sitesAdmin.titleDelete')}><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              );
            })}
            {sites.length === 0 && <tr><td className="td muted-2" colSpan={canEdit ? 5 : 4}>{t('sitesAdmin.emptyRow')}</td></tr>}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs muted">{t('sitesAdmin.nameLabel')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('sitesAdmin.namePlaceholder')} className="field w-56" />
          </div>
          <div>
            <label className="mb-1 block text-xs muted">{t('sitesAdmin.kindLabel')}</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="field w-32">
              <option value="VLASTNI">{t('sitesAdmin.kindOwn')}</option>
              <option value="PARTNER">{t('sitesAdmin.kindPartner')}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs muted">{t('sitesAdmin.subnetsLabel')}</label>
            <input value={subnets} onChange={(e) => setSubnets(e.target.value)} placeholder={t('sitesAdmin.subnetsPlaceholder')} className="field w-72" />
          </div>
          <button onClick={add} className="btn-primary"><Plus size={15} /> {t('sitesAdmin.addBtn')}</button>
        </div>
      )}
      <p className="mt-3 text-xs muted-2">{t('sitesAdmin.tipLine1')}<code>10.30.0.0/16</code>{t('sitesAdmin.tipLine2')}<b>{t('sitesAdmin.tipPartnerEmphasis')}</b>{t('sitesAdmin.tipLine3')}</p>
    </div>
  );
}
