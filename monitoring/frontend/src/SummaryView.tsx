import { useEffect, useState, useMemo } from 'react';
import { FileSpreadsheet, FileDown, Search } from 'lucide-react';
import { api, type SummaryRow } from './api.js';
import { minutesToHm } from './util.js';
import { useT } from './i18n/index.js';
import { useSort, SortHeader } from './tableSort.js';

type Props = { from: string; to: string; department?: string };

export function SummaryView({ from, to, department }: Props) {
  const { t } = useT();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.summary(from, to, department)
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [from, to, department]);

  // Filter podle searchu (jméno + oddělení).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.displayName ?? '').toLowerCase().includes(q) ||
      (r.department ?? '').toLowerCase().includes(q));
  }, [rows, search]);

  const { sorted, key, dir, setSort } = useSort(filtered, 'activeMinutes', 'desc');

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => api.exportHourly(from, to, { department }).catch((e) => setError(String(e)))} className="btn-primary">
          <FileSpreadsheet size={15} /> {t('summary.exportExcel')}
        </button>
        <button onClick={() => api.exportIntervals(from, to).catch((e) => setError(String(e)))} className="btn-ghost">
          <FileDown size={15} /> {t('summary.exportRaw')}
        </button>
        <div className="flex items-center gap-2">
          <Search size={14} className="muted-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="field w-56"
          />
        </div>
        <span className="text-xs muted-2">{t('common.shownOfTotal', { shown: sorted.length, total: rows.length })}</span>
        {loading && <span className="text-sm text-blue-500">{t('summary.loading')}</span>}
        {error && <span className="text-sm text-red-500">{t('summary.errorPrefix')}: {error}</span>}
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <SortHeader sortKey="displayName" current={key} dir={dir} onChange={setSort}>{t('summary.colEmployee')}</SortHeader>
            <SortHeader sortKey="department" current={key} dir={dir} onChange={setSort}>{t('summary.colDepartment')}</SortHeader>
            <SortHeader sortKey="activeMinutes" current={key} dir={dir} onChange={setSort} align="right">{t('summary.colActiveWork')}</SortHeader>
            <SortHeader sortKey="idleMinutes" current={key} dir={dir} onChange={setSort} align="right">{t('summary.colIdle')}</SortHeader>
            <SortHeader sortKey="lockedMinutes" current={key} dir={dir} onChange={setSort} align="right">{t('summary.colLocked')}</SortHeader>
            <SortHeader sortKey="avgKpm" current={key} dir={dir} onChange={setSort} align="right">{t('summary.colTypingSpeed')}</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.userId} className="divide-row">
              <td className="td font-medium">{r.displayName ?? r.userId}</td>
              <td className="td muted">{r.department ?? '—'}</td>
              <td className="td text-right tabular-nums text-emerald-500">{minutesToHm(r.activeMinutes)}</td>
              <td className="td text-right tabular-nums muted">{minutesToHm(r.idleMinutes)}</td>
              <td className="td text-right tabular-nums muted-2">{minutesToHm(r.lockedMinutes)}</td>
              <td className="td text-right tabular-nums">{r.avgKpm}</td>
            </tr>
          ))}
          {sorted.length === 0 && !loading && <tr><td colSpan={6} className="td py-6 text-center muted-2">{t('summary.noData')}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
