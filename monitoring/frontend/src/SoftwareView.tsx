import { useEffect, useMemo, useState } from 'react';
import { Boxes, KeyRound, Wallet, Save, Coins, AlertTriangle, Search } from 'lucide-react';
import { api, type SoftwareAudit, type SoftwareItem, type CostResult } from './api.js';
import { PageSkeleton } from './Skeleton.js';
import { useToast } from './Toast.js';
import { AppIcon, useAppName } from './appMeta.js';
import { useT } from './i18n/index.js';
import { useSort, SortHeader } from './tableSort.js';

export function SoftwareView({ from, to, department, canEdit }: { from: string; to: string; department?: string; canEdit: boolean }) {
  const { t } = useT();
  const appName = useAppName();
  const [data, setData] = useState<SoftwareAudit | null>(null);
  const [cost, setCost] = useState<CostResult | null>(null);
  const [edit, setEdit] = useState<Record<string, { licensed: boolean; seats: string; cost: string }>>({});
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [appSearch, setAppSearch] = useState('');
  const toast = useToast();
  const mult = period === 'year' ? 12 : 1;
  const unit = period === 'year' ? t('software.periodYear') : t('software.periodMonth');
  const kc = (v: number) => `${(v * mult).toLocaleString('cs-CZ')} ${t('software.currency')}`;

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
  // Filter SW audit polozek podle searchu (app jmeno + kategorie).
  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const q = appSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.app.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q));
  }, [data, appSearch]);
  const { sorted: sortedItems, key: itemsKey, dir: itemsDir, setSort: setItemsSort } = useSort(filteredItems, 'activeHours', 'desc');
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
    }).then(() => toast(t('software.savedToast', { app: it.app }))).catch(() => toast(t('software.saveFailed'), 'error'));
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-slate-800">
          <button onClick={() => setPeriod('month')} className={`rounded px-3 py-1 ${period === 'month' ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>{t('software.forMonth')}</button>
          <button onClick={() => setPeriod('year')} className={`rounded px-3 py-1 ${period === 'year' ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>{t('software.forYear')}</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase muted-2"><Wallet size={13} /> {t('software.wasteKpi', { unit })}</div>
          <div className="text-3xl font-bold text-red-500">{kc(data.totalWasteCost)}</div>
          <div className="text-xs muted-2">{t('software.wasteKpiDesc', { unit })}</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase muted-2"><Wallet size={13} /> {t('software.savingKpi', { unit })}</div>
          <div className="text-3xl font-bold text-emerald-600">{kc(data.totalWasteCost)}</div>
          <div className="text-xs muted-2">{t('software.savingKpiDesc', { unit })}</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase muted-2"><Boxes size={13} /> {t('software.workforceKpi')}</div>
          <div className="text-3xl font-bold">{data.workforce}</div>
          <div className="text-xs muted-2">{t('software.workforceKpiDesc')}</div>
        </div>
      </div>

      {/* Náklady neproduktivního času */}
      {cost && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Coins size={16} className="text-red-500" /> {t('software.costTitle')}</h3>
          <p className="mb-3 text-xs muted-2">{t('software.costHint', { with: cost.withRate, total: cost.workforce })}</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <CostCard label={t('software.costNonwork')} value={cost.totals.nonworkCost} currency={t('software.currency')} />
            <CostCard label={t('software.costIdle')} value={cost.totals.idleCost} currency={t('software.currency')} />
            <CostCard label={t('software.costPcoff')} value={cost.totals.pcoffCost} currency={t('software.currency')} />
            <CostCard label={t('software.costTotal')} value={cost.totals.wastedCost} currency={t('software.currency')} big />
          </div>
          {cost.totals.wastedCost === 0 && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={14} /> {t('software.costNoRates')}
            </p>
          )}
          <table className="w-full">
            <thead><tr>
              <th className="th">{t('software.costColEmployee')}</th>
              <th className="th">{t('software.costColDept')}</th>
              <th className="th text-right">{t('software.costColRate')}</th>
              <th className="th text-right">{t('software.costColFun')}</th>
              <th className="th text-right">{t('software.costColIdle')}</th>
              <th className="th text-right">{t('software.costColPcoff')}</th>
              <th className="th text-right">{t('software.costColTotal')}</th>
            </tr></thead>
            <tbody>
              {cost.perUser.slice(0, 10).map((u) => (
                <tr key={u.userId} className="divide-row">
                  <td className="td font-medium">{u.displayName}</td>
                  <td className="td muted">{u.department}</td>
                  <td className="td text-right tabular-nums muted">{u.hourlyRate != null ? `${u.hourlyRate} ${t('software.currency')}` : '—'}</td>
                  <td className="td text-right tabular-nums">{u.nonworkHours} h</td>
                  <td className="td text-right tabular-nums">{u.idleHours} h</td>
                  <td className="td text-right tabular-nums">{u.pcoffHours} h</td>
                  <td className="td text-right tabular-nums font-semibold text-red-500">{u.wastedCost != null ? `${u.wastedCost.toLocaleString('cs-CZ')} ${t('software.currency')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} className="text-emerald-600" /> {t('software.auditTitle')}</h3>
          <div className="flex items-center gap-2">
            <Search size={14} className="muted-2" />
            <input value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder={t('software.searchAppPlaceholder')} className="field w-56" />
            <span className="text-xs muted-2">{t('common.shownOfTotal', { shown: sortedItems.length, total: data.items.length })}</span>
          </div>
        </div>
        <p className="mb-2 text-xs muted-2">{t('software.auditHint')}</p>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="font-semibold">{t('software.utilLegendTitle')}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> {t('software.utilLegendGood')}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-amber-500" /> {t('software.utilLegendMid')}</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-red-500" /> {t('software.utilLegendBad')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <SortHeader sortKey="app" current={itemsKey} dir={itemsDir} onChange={setItemsSort}>{t('software.colApp')}</SortHeader>
                <SortHeader sortKey="category" current={itemsKey} dir={itemsDir} onChange={setItemsSort}>{t('software.colCategory')}</SortHeader>
                <SortHeader sortKey="activeHours" current={itemsKey} dir={itemsDir} onChange={setItemsSort} align="right">{t('software.colActiveHours')}</SortHeader>
                <SortHeader sortKey="users" current={itemsKey} dir={itemsDir} onChange={setItemsSort} align="right">{t('software.colUsersCount')}</SortHeader>
                <th className="th text-center">{t('software.colLicensed')}</th>
                <SortHeader sortKey="seats" current={itemsKey} dir={itemsDir} onChange={setItemsSort} align="right">{t('software.colSeats')}</SortHeader>
                <SortHeader sortKey="costPerSeat" current={itemsKey} dir={itemsDir} onChange={setItemsSort} align="right">{t('software.colCostPerSeat')}</SortHeader>
                <SortHeader sortKey="utilizationPct" current={itemsKey} dir={itemsDir} onChange={setItemsSort} align="right">{t('software.colUtilization')}</SortHeader>
                <SortHeader sortKey="wasteCost" current={itemsKey} dir={itemsDir} onChange={setItemsSort} align="right">{t('software.colWasteUnit', { unit })}</SortHeader>
                {canEdit && <th className="th"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((i) => {
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
                        <td className="td text-center">{i.licensed ? t('software.licensedYes') : '—'}</td>
                        <td className="td text-right tabular-nums">{i.seats ?? '—'}</td>
                        <td className="td text-right tabular-nums">{i.costPerSeat != null ? `${i.costPerSeat} ${t('software.currency')}` : '—'}</td>
                      </>
                    )}
                    <td className={`td text-right tabular-nums font-semibold ${utilColor}`}>{util != null ? `${util}%` : '—'}</td>
                    <td className="td text-right tabular-nums font-semibold text-red-500">{i.wasteCost ? kc(i.wasteCost) : '—'}</td>
                    {canEdit && <td className="td text-right"><button onClick={() => saveLicense(i)} className="btn-ghost px-2"><Save size={14} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs muted-2">{t('software.tipExceed')}</p>
      </div>
    </div>
  );
}

function CostCard({ label, value, currency, big }: { label: string; value: number; currency: string; big?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${big ? 'border-red-300 dark:border-red-500/40' : 'border-gray-200 dark:border-slate-700'}`}>
      <div className="text-xs uppercase muted-2">{label}</div>
      <div className={`font-bold ${big ? 'text-2xl text-red-500' : 'text-xl'}`}>{value.toLocaleString('cs-CZ')} {currency}</div>
    </div>
  );
}
