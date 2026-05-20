import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type AppCategoryRow, type WebRuleRow } from './api.js';
import { chipClass, typeLabel } from './util.js';

const TYPES = ['WORK', 'NON_WORK', 'NEUTRAL'];

export function CategoryAdmin({ canEdit }: { canEdit: boolean }) {
  const [cats, setCats] = useState<AppCategoryRow[]>([]);
  const [rules, setRules] = useState<WebRuleRow[]>([]);
  const [newCat, setNewCat] = useState({ appName: '', category: '', type: 'WORK' });
  const [newRule, setNewRule] = useState({ keyword: '', category: '', type: 'NON_WORK' });

  function load() {
    api.adminCategories().then(setCats).catch(() => undefined);
    api.adminWebRules().then(setRules).catch(() => undefined);
  }
  useEffect(load, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Aplikace */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">Kategorie aplikací (proces)</h3>
        {canEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input placeholder="napr. winword.exe" value={newCat.appName} onChange={(e) => setNewCat({ ...newCat, appName: e.target.value })} className="field w-40" />
            <input placeholder="kategorie" value={newCat.category} onChange={(e) => setNewCat({ ...newCat, category: e.target.value })} className="field w-32" />
            <select value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })} className="field">
              {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={async () => { if (newCat.appName && newCat.category) { await api.saveCategory(newCat); setNewCat({ appName: '', category: '', type: 'WORK' }); load(); } }}
            >
              <Plus size={15} /> Přidat
            </button>
          </div>
        )}
        <div className="max-h-80 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">Aplikace</th><th className="th">Kategorie</th><th className="th">Typ</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="divide-row">
                  <td className="td font-mono text-xs">{c.appName}</td>
                  <td className="td">{c.category}</td>
                  <td className="td"><span className={chipClass(c.type)}>{typeLabel(c.type)}</span></td>
                  {canEdit && <td className="td text-right"><button onClick={async () => { await api.deleteCategory(c.appName); load(); }} className="muted-2 hover:text-red-500"><Trash2 size={15} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weby */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold">Pravidla pro weby (klíčové slovo v titulku)</h3>
        <p className="mb-3 text-xs muted-2">Titulek okna obsahuje klíčové slovo → kategorie/typ.</p>
        {canEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input placeholder="napr. youtube" value={newRule.keyword} onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })} className="field w-40" />
            <input placeholder="kategorie" value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })} className="field w-32" />
            <select value={newRule.type} onChange={(e) => setNewRule({ ...newRule, type: e.target.value })} className="field">
              {TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={async () => { if (newRule.keyword && newRule.category) { await api.saveWebRule(newRule); setNewRule({ keyword: '', category: '', type: 'NON_WORK' }); load(); } }}
            >
              <Plus size={15} /> Přidat
            </button>
          </div>
        )}
        <div className="max-h-80 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">Klíčové slovo</th><th className="th">Kategorie</th><th className="th">Typ</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="divide-row">
                  <td className="td font-mono text-xs">{r.keyword}</td>
                  <td className="td">{r.category}</td>
                  <td className="td"><span className={chipClass(r.type)}>{typeLabel(r.type)}</span></td>
                  {canEdit && <td className="td text-right"><button onClick={async () => { await api.deleteWebRule(r.keyword); load(); }} className="muted-2 hover:text-red-500"><Trash2 size={15} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
