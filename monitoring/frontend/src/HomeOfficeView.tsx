import { useEffect, useState, useMemo } from 'react';
import { House, Building2, ArrowDown, ArrowUp, Search } from 'lucide-react';
import { api, type HomeOffice } from './api.js';
import { ScoreScaleLegend } from './Legend.js';
import { scoreColor } from './util.js';
import { useT } from './i18n/index.js';
import { useSort, SortHeader } from './tableSort.js';
import { MetricInfo } from './MetricInfo.js';
import { PageSkeleton } from './Skeleton.js';

function BigScore({ icon, label, score, sub, info }: { icon: React.ReactNode; label: string; score: number; sub: string; info?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center p-6">
      <div className="mb-1 flex items-center gap-2 text-sm muted">{icon} {label}{info && <MetricInfo text={info} />}</div>
      <div className="text-5xl font-bold" style={{ color: scoreColor(score) }}>{score}%</div>
      <div className="mt-1 text-xs muted-2">{sub}</div>
    </div>
  );
}

export function HomeOfficeView({ from, to, department, onOpenUser }: {
  from: string; to: string; department?: string; onOpenUser: (id: string) => void;
}) {
  const { t } = useT();
  const [d, setD] = useState<HomeOffice | null>(null);
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [search, setSearch] = useState('');
  useEffect(() => { api.homeOffice(from, to, department).then(setD).catch(() => setD(null)); }, [from, to, department]);
  // Sort + filter MUSI byt definovany pred early returnem - jinak React poradi
  // hooks porusi konzistenci pri prepnuti dat.
  const allPerUser = useMemo(() => d?.perUser ?? [], [d]);
  const filteredPerUser = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPerUser;
    return allPerUser.filter((u) =>
      (u.displayName ?? '').toLowerCase().includes(q) ||
      (u.department ?? '').toLowerCase().includes(q));
  }, [allPerUser, search]);
  const { sorted: sortedPerUser, key, dir, setSort } = useSort(filteredPerUser, 'diff', 'asc');
  if (!d) return <PageSkeleton />;

  const diff = d.company.hoScore - d.company.officeScore;
  const amt = (days: number) => (unit === 'hours' ? `${days * 8} h` : `${days} ${t('homeoffice.daysShort')}`);

  return (
    <div className="space-y-4">
      <ScoreScaleLegend />

      {/* Rychlý přehled HO množství + přepínač jednotek */}
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <div>
          <div className="text-xs uppercase muted-2">{t('homeoffice.hoWorkedTitle')}</div>
          <div className="text-2xl font-bold">{amt(d.company.hoDays)}</div>
          <div className="text-xs muted-2">{t('homeoffice.hoWorkedEmployees', { n: d.company.usersWithHo })}</div>
        </div>
        <div className="ml-auto flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-slate-800">
          <button onClick={() => setUnit('hours')} className={`rounded px-3 py-1 ${unit === 'hours' ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>{t('homeoffice.unitHours')}</button>
          <button onClick={() => setUnit('days')} className={`rounded px-3 py-1 ${unit === 'days' ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>{t('homeoffice.unitDays')}</button>
        </div>
      </div>

      {/* Headline srovnání */}
      <div className="grid gap-4 md:grid-cols-3">
        <BigScore icon={<House size={16} className="text-emerald-600" />} label={t('homeoffice.hoScoreLabel')} score={d.company.hoScore} sub={t('homeoffice.hoActiveSub', { amt: amt(d.company.hoDays), h: d.company.hoActiveHours })} info={t('methodology.homeOfficeScore')} />
        <BigScore icon={<Building2 size={16} className="text-emerald-600" />} label={t('homeoffice.officeScoreLabel')} score={d.company.officeScore} sub={t('homeoffice.officeActiveSub', { amt: amt(d.company.officeDays), h: d.company.officeActiveHours })} info={t('methodology.homeOfficeScore')} />
        <div className="card flex flex-col items-center justify-center p-6">
          <div className="mb-1 text-center text-sm muted">{t('homeoffice.diffLabel')}</div>
          <div className={`flex items-center gap-1 text-4xl font-bold ${diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {diff < 0 ? <ArrowDown size={28} /> : <ArrowUp size={28} />} {diff > 0 ? '+' : ''}{diff} {t('homeoffice.pp')}
          </div>
          <div className="mt-2 text-center text-xs muted-2">
            {diff < -3 ? t('homeoffice.diffWorse') : diff > 3 ? t('homeoffice.diffBetter') : t('homeoffice.diffSimilar')}
          </div>
        </div>
      </div>

      {/* Podíl zábavy */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-dense"><div className="text-xs uppercase muted-2">{t('homeoffice.funShareHo')}</div><div className="text-2xl font-bold text-red-500">{d.company.hoNonWorkPct} %</div></div>
        <div className="card-dense"><div className="text-xs uppercase muted-2">{t('homeoffice.funShareOffice')}</div><div className="text-2xl font-bold">{d.company.officeNonWorkPct} %</div></div>
      </div>

      {/* Oddělení */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('homeoffice.byDeptTitle')}</h3>
        <div className="space-y-3">
          {d.byDept.map((x) => (
            <div key={x.department} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-sm">
                {x.department}
                <span className="ml-1 text-xs muted-2">({amt(x.hoDays)} {t('homeoffice.hoSuffix')})</span>
              </div>
              <div className="flex-1 space-y-1">
                <Bar label={t('homeoffice.barHomeOffice')} value={x.hoScore} color="#6366f1" />
                <Bar label={t('homeoffice.barOffice')} value={x.officeScore} color="#64748b" />
              </div>
            </div>
          ))}
          {d.byDept.length === 0 && <p className="text-sm muted-2">{t('homeoffice.noHoDays')}</p>}
        </div>
        <div className="mt-3 flex gap-4 text-xs muted">
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: '#6366f1' }} /> {t('homeoffice.legendHomeOffice')}</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: '#64748b' }} /> {t('homeoffice.legendOffice')}</span>
          <span className="muted-2">{t('homeoffice.legendScale')}</span>
        </div>
      </div>

      {/* Per-user: největší propad na HO */}
      <div className="card p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('homeoffice.perUserTitle')}</h3>
          <div className="flex items-center gap-2">
            <Search size={14} className="muted-2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.searchPlaceholder')} className="field w-56" />
            <span className="text-xs muted-2">{t('common.shownOfTotal', { shown: sortedPerUser.length, total: allPerUser.length })}</span>
          </div>
        </div>
        <p className="mb-3 text-xs muted-2">{t('homeoffice.perUserHint')}</p>
        <table className="w-full">
          <thead><tr>
            <SortHeader sortKey="displayName" current={key} dir={dir} onChange={setSort}>{t('homeoffice.perUserColUser')}</SortHeader>
            <SortHeader sortKey="department" current={key} dir={dir} onChange={setSort}>{t('homeoffice.perUserColDept')}</SortHeader>
            <SortHeader sortKey="hoDays" current={key} dir={dir} onChange={setSort} align="right">{t('homeoffice.perUserColHoDays', { unit: unit === 'hours' ? t('homeoffice.unitHoursShort') : t('homeoffice.unitDaysShort') })}</SortHeader>
            <SortHeader sortKey="hoScore" current={key} dir={dir} onChange={setSort} align="right">{t('homeoffice.perUserColHoScore')}</SortHeader>
            <SortHeader sortKey="officeScore" current={key} dir={dir} onChange={setSort} align="right">{t('homeoffice.perUserColOfficeScore')}</SortHeader>
            <SortHeader sortKey="diff" current={key} dir={dir} onChange={setSort} align="right">{t('homeoffice.perUserColDiff')}</SortHeader>
          </tr></thead>
          <tbody>
            {sortedPerUser.map((u) => (
              <tr key={u.userId} className="divide-row">
                <td className="td"><button onClick={() => onOpenUser(u.userId)} className="font-medium hover:underline">{u.displayName}</button></td>
                <td className="td muted">{u.department}</td>
                <td className="td text-right tabular-nums">{unit === 'hours' ? u.hoDays * 8 : u.hoDays}</td>
                <td className="td text-right tabular-nums font-semibold" style={{ color: scoreColor(u.hoScore) }}>{u.hoScore}%</td>
                <td className="td text-right tabular-nums muted">{u.officeScore}%</td>
                <td className={`td text-right tabular-nums font-semibold ${u.diff < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{u.diff > 0 ? '+' : ''}{u.diff}</td>
              </tr>
            ))}
            {sortedPerUser.length === 0 && <tr><td colSpan={6} className="td py-6 text-center muted-2">{search ? t('common.noData') : t('homeoffice.noHoDays')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs muted-2">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
