import { useEffect, useState } from 'react';
import { Plus, Trash2, Download, Upload, ChevronDown } from 'lucide-react';
import { api, type AppCategoryRow, type WebRuleRow, type DeptRuleRow } from './api.js';
import { chipClass, typeLabel } from './util.js';
import { useToast } from './Toast.js';
import { useT } from './i18n/index.js';

const TYPES = ['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN'];

/**
 * Klikabilní chip s typem, který přepíná na select pro inline reklasifikaci.
 * Po vybrání typu zavolá `onSave(newType)` a vrátí se zpět na zobrazený chip.
 * Vlastní stav `editing` jen pro fokusovaný UI – uložení řídí parent.
 */
function TypePicker({ value, onSave, canEdit }: { value: string; onSave: (newType: string) => Promise<void> | void; canEdit: boolean }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (!canEdit) return <span className={chipClass(value)}>{typeLabel(value)}</span>;
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title={t('categoryAdmin.clickToReclassify')}
        className={`${chipClass(value)} inline-flex items-center gap-0.5 cursor-pointer hover:opacity-80`}
      >
        {typeLabel(value)}<ChevronDown size={11} className="opacity-60" />
      </button>
    );
  }
  return (
    <select
      autoFocus
      value={value}
      onBlur={() => setEditing(false)}
      onChange={async (e) => {
        const newType = e.target.value;
        setEditing(false);
        if (newType !== value) await onSave(newType);
      }}
      className="field h-7 py-0 text-xs"
    >
      {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
    </select>
  );
}

export function CategoryAdmin({ canEdit, from, to }: { canEdit: boolean; from: string; to: string }) {
  const { t } = useT();
  const [cats, setCats] = useState<AppCategoryRow[]>([]);
  const [rules, setRules] = useState<WebRuleRow[]>([]);
  const [deptRules, setDeptRules] = useState<DeptRuleRow[]>([]);
  const [newCat, setNewCat] = useState({ appName: '', category: '', type: 'WORK' });
  const [newRule, setNewRule] = useState({ keyword: '', category: '', type: 'NON_WORK' });
  const [newDept, setNewDept] = useState({ department: '', category: '', type: 'WORK' });
  const toast = useToast();

  function load() {
    api.adminCategories().then(setCats).catch(() => undefined);
    api.adminWebRules().then(setRules).catch(() => undefined);
    api.adminDeptRules().then(setDeptRules).catch(() => undefined);
  }
  useEffect(load, []);

  async function doExport() {
    const data = await api.classificationExport(from, to);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'klasifikace-k-zarazeni.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function doImport() {
    const text = prompt(t('categoryAdmin.importPrompt'));
    if (!text) return;
    try {
      const r = await api.classificationImport(JSON.parse(text));
      if (r.ok) toast(t('categoryAdmin.importSuccess', { cats: r.categories, rules: r.webRules }));
      else toast(t('categoryAdmin.importFailed', { err: r.error }), 'error');
      load();
    } catch {
      toast(t('categoryAdmin.invalidJson'), 'error');
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-medium">{t('categoryAdmin.batchLabel')}</span>
          <button onClick={doExport} className="btn-ghost"><Download size={15} /> {t('categoryAdmin.exportBtn')}</button>
          <button onClick={doImport} className="btn-ghost"><Upload size={15} /> {t('categoryAdmin.importBtn')}</button>
          <span className="text-xs muted-2">{t('categoryAdmin.batchHint')}</span>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
      {/* Aplikace */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('categoryAdmin.appsTitle')}</h3>
        {canEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input placeholder={t('categoryAdmin.appNamePlaceholder')} value={newCat.appName} onChange={(e) => setNewCat({ ...newCat, appName: e.target.value })} className="field w-40" />
            <input placeholder={t('categoryAdmin.categoryPlaceholder')} value={newCat.category} onChange={(e) => setNewCat({ ...newCat, category: e.target.value })} className="field w-32" />
            <select value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })} className="field">
              {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={async () => { if (newCat.appName && newCat.category) { await api.saveCategory(newCat); setNewCat({ appName: '', category: '', type: 'WORK' }); load(); } }}
            >
              <Plus size={15} /> {t('categoryAdmin.addBtn')}
            </button>
          </div>
        )}
        <div className="max-h-80 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">{t('categoryAdmin.colApp')}</th><th className="th">{t('categoryAdmin.colCategory')}</th><th className="th">{t('categoryAdmin.colType')}</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="divide-row">
                  <td className="td font-mono text-xs">{c.appName}</td>
                  <td className="td">{c.category}</td>
                  <td className="td">
                    <TypePicker
                      value={c.type}
                      canEdit={canEdit}
                      onSave={async (newType) => {
                        await api.saveCategory({ appName: c.appName, category: c.category, type: newType });
                        toast(t('categoryAdmin.saved', { name: c.appName, type: typeLabel(newType) }));
                        load();
                      }}
                    />
                  </td>
                  {canEdit && <td className="td text-right"><button onClick={async () => { await api.deleteCategory(c.appName); load(); }} className="muted-2 hover:text-red-500"><Trash2 size={15} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weby */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold">{t('categoryAdmin.webTitle')}</h3>
        <p className="mb-3 text-xs muted-2">{t('categoryAdmin.webHint')}</p>
        {canEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input placeholder={t('categoryAdmin.webKeywordPlaceholder')} value={newRule.keyword} onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })} className="field w-40" />
            <input placeholder={t('categoryAdmin.categoryPlaceholder')} value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })} className="field w-32" />
            <select value={newRule.type} onChange={(e) => setNewRule({ ...newRule, type: e.target.value })} className="field">
              {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={async () => { if (newRule.keyword && newRule.category) { await api.saveWebRule(newRule); setNewRule({ keyword: '', category: '', type: 'NON_WORK' }); load(); } }}
            >
              <Plus size={15} /> {t('categoryAdmin.addBtn')}
            </button>
          </div>
        )}
        <div className="max-h-80 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">{t('categoryAdmin.colKeyword')}</th><th className="th">{t('categoryAdmin.colCategory')}</th><th className="th">{t('categoryAdmin.colType')}</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="divide-row">
                  <td className="td font-mono text-xs">{r.keyword}</td>
                  <td className="td">{r.category}</td>
                  <td className="td">
                    <TypePicker
                      value={r.type}
                      canEdit={canEdit}
                      onSave={async (newType) => {
                        await api.saveWebRule({ keyword: r.keyword, category: r.category, type: newType });
                        toast(t('categoryAdmin.saved', { name: r.keyword, type: typeLabel(newType) }));
                        load();
                      }}
                    />
                  </td>
                  {canEdit && <td className="td text-right"><button onClick={async () => { await api.deleteWebRule(r.keyword); load(); }} className="muted-2 hover:text-red-500"><Trash2 size={15} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Pravidla podle oddělení */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold">{t('categoryAdmin.deptTitle')}</h3>
        <p className="mb-3 text-xs muted-2">{t('categoryAdmin.deptHintLine1')}<b>{t('categoryAdmin.deptHintLinkedIn')}</b>{t('categoryAdmin.deptHintLine2')}</p>
        {canEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input placeholder={t('categoryAdmin.deptDeptPlaceholder')} value={newDept.department} onChange={(e) => setNewDept({ ...newDept, department: e.target.value })} className="field w-48" />
            <input placeholder={t('categoryAdmin.deptCategoryPlaceholder')} value={newDept.category} onChange={(e) => setNewDept({ ...newDept, category: e.target.value })} className="field w-40" />
            <select value={newDept.type} onChange={(e) => setNewDept({ ...newDept, type: e.target.value })} className="field">
              {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={async () => { if (newDept.department && newDept.category) { await api.saveDeptRule(newDept); setNewDept({ department: '', category: '', type: 'WORK' }); load(); } }}
            >
              <Plus size={15} /> {t('categoryAdmin.addBtn')}
            </button>
          </div>
        )}
        <div className="max-h-80 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">{t('categoryAdmin.colDept')}</th><th className="th">{t('categoryAdmin.colCategory')}</th><th className="th">{t('categoryAdmin.colType')}</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {deptRules.map((r) => (
                <tr key={r.id} className="divide-row">
                  <td className="td">{r.department}</td>
                  <td className="td">{r.category}</td>
                  <td className="td">
                    <TypePicker
                      value={r.type}
                      canEdit={canEdit}
                      onSave={async (newType) => {
                        await api.saveDeptRule({ department: r.department, category: r.category, type: newType });
                        toast(t('categoryAdmin.saved', { name: r.department, type: typeLabel(newType) }));
                        load();
                      }}
                    />
                  </td>
                  {canEdit && <td className="td text-right"><button onClick={async () => { await api.deleteDeptRule(r.id); load(); }} className="muted-2 hover:text-red-500"><Trash2 size={15} /></button></td>}
                </tr>
              ))}
              {deptRules.length === 0 && <tr><td className="td muted-2" colSpan={canEdit ? 4 : 3}>{t('categoryAdmin.deptEmpty')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
