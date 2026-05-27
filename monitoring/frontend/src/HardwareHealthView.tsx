import { useEffect, useState } from 'react';
import { HeartPulse, AlertTriangle, AlertOctagon, CheckCircle2, BatteryLow, HardDrive, Cpu, ShieldOff, RefreshCw, X, Trash2 } from 'lucide-react';
import { api, type DeviceHealthRow, type DeviceHealthDetail, type HealthStatus } from './api.js';
import { useT, type Locale } from './i18n/index.js';

// Mapování locale → BCP-47 pro toLocale*String (čeština chce 'cs-CZ' atd.)
function bcp47(locale: Locale): string {
  return ({ cs: 'cs-CZ', sk: 'sk-SK', en: 'en-US', pl: 'pl-PL', de: 'de-DE' } as const)[locale] ?? 'cs-CZ';
}

function StatusBadge({ s }: { s: HealthStatus }) {
  const { t } = useT();
  if (s === 'CRITICAL') return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"><AlertOctagon size={12} /> {t('health.critical')}</span>;
  if (s === 'WARN') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><AlertTriangle size={12} /> {t('health.warn')}</span>;
  if (s === 'OK') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 size={12} /> {t('health.statusOk')}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-slate-600/40 dark:text-slate-300">{t('health.unreported')}</span>;
}

function pctBar(pct: number | null, warnAt = 85, critAt = 95) {
  if (pct === null) return <span className="muted-2">—</span>;
  const color = pct >= critAt ? 'bg-red-500' : pct >= warnAt ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded bg-gray-200 dark:bg-slate-700"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
      <span className="text-xs tabular-nums">{pct} %</span>
    </div>
  );
}

function batteryHealth(pct: number | null) {
  if (pct === null) return <span className="muted-2">—</span>;
  const color = pct < 50 ? 'text-red-500' : pct < 70 ? 'text-amber-500' : 'text-emerald-600';
  return <span className={`tabular-nums font-medium ${color}`}>{pct} %</span>;
}

export function HardwareHealthView() {
  const { t } = useT();
  const [rows, setRows] = useState<DeviceHealthRow[]>([]);
  const [summary, setSummary] = useState<{ critical: number; warn: number; ok: number; unreported: number }>({ critical: 0, warn: 0, ok: 0, unreported: 0 });
  const [filter, setFilter] = useState<'ALL' | HealthStatus>('ALL');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<DeviceHealthDetail | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    api.deviceHealth().then((d) => { setRows(d.rows); setSummary(d.summary); }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = rows.filter((r) => (filter === 'ALL' || r.status === filter) && (!search || r.hostname.toLowerCase().includes(search.toLowerCase()) || (r.model ?? '').toLowerCase().includes(search.toLowerCase()) || (r.primaryUser ?? '').toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <HeartPulse size={18} className="text-emerald-600" />
          <span className="font-medium">{t('health.title')}</span>
          <span className="muted-2">{t('health.summaryHint')}</span>
        </div>
        <button onClick={load} className="btn-ghost text-xs"><RefreshCw size={13} /> {t('common.refresh')}</button>
      </div>

      {/* Souhrn */}
      <div className="grid gap-3 sm:grid-cols-4">
        <button onClick={() => setFilter('CRITICAL')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-red-300 ${filter === 'CRITICAL' ? 'ring-2 ring-red-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">{t('health.critical')}</div><div className="text-2xl font-bold text-red-500">{summary.critical}</div></div>
          <AlertOctagon size={28} className="text-red-400" />
        </button>
        <button onClick={() => setFilter('WARN')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-amber-300 ${filter === 'WARN' ? 'ring-2 ring-amber-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">{t('health.warn')}</div><div className="text-2xl font-bold text-amber-500">{summary.warn}</div></div>
          <AlertTriangle size={28} className="text-amber-400" />
        </button>
        <button onClick={() => setFilter('OK')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-emerald-300 ${filter === 'OK' ? 'ring-2 ring-emerald-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">{t('health.statusOk')}</div><div className="text-2xl font-bold text-emerald-600">{summary.ok}</div></div>
          <CheckCircle2 size={28} className="text-emerald-400" />
        </button>
        <button onClick={() => setFilter('UNREPORTED')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-gray-300 ${filter === 'UNREPORTED' ? 'ring-2 ring-gray-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">{t('health.unreported')}</div><div className="text-2xl font-bold text-gray-500">{summary.unreported}</div></div>
          <HeartPulse size={28} className="text-gray-400" />
        </button>
      </div>

      {/* Filtr + hledání */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('ALL')} className={`btn-ghost text-xs ${filter === 'ALL' ? 'ring-1 ring-emerald-400' : ''}`}>{t('common.all')}</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('health.searchPlaceholder')} className="field w-64" />
        <span className="text-xs muted-2">{t('health.shownCount', { shown: filtered.length, total: rows.length })}</span>
      </div>

      {/* Tabulka */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-auto">
          <table className="w-full">
            <thead><tr className="text-left">
              <th className="th">{t('health.columnState')}</th><th className="th">{t('health.columnHostUser')}</th><th className="th">{t('health.columnModel')}</th>
              <th className="th">{t('health.battery')}</th><th className="th">{t('health.columnDisk')}</th><th className="th">{t('health.ram')}</th>
              <th className="th">{t('health.columnUpdates')}</th><th className="th">{t('health.columnAntivirus')}</th><th className="th">{t('health.columnMessages')}</th>
              <th className="th w-10"></th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.deviceId} className="divide-row cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5" onClick={() => api.deviceHealthDetail(r.deviceId).then(setOpen)}>
                  <td className="td"><StatusBadge s={r.status} /></td>
                  <td className="td">
                    <div className="font-medium">{r.hostname}</div>
                    {r.primaryUser && <div className="text-[11px] muted-2">{r.primaryUser}{r.primaryDepartment ? ` · ${r.primaryDepartment}` : ''}</div>}
                  </td>
                  <td className="td text-xs muted-2">{r.manufacturer ?? '—'} {r.model ?? ''}</td>
                  <td className="td">{batteryHealth(r.batteryHealthPct)}</td>
                  <td className="td">{pctBar(r.diskTopUsedPct, 85, 95)}</td>
                  <td className="td">{pctBar(r.ramUsedPct, 90, 95)}</td>
                  <td className="td text-xs tabular-nums">{r.pendingUpdates ?? '—'}</td>
                  <td className="td">{r.antivirusEnabled === false ? <span className="inline-flex items-center gap-1 text-red-500"><ShieldOff size={13} /> {t('health.avOff')}</span> : r.antivirusEnabled === true ? <span className="text-emerald-600">{t('health.avOn')}</span> : <span className="muted-2">—</span>}</td>
                  <td className="td text-xs muted-2">{r.issues.length > 0 ? r.issues.slice(0, 2).join('; ') + (r.issues.length > 2 ? ` (+${r.issues.length - 2})` : '') : '—'}</td>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <button
                      title={t('health.deleteTooltip')}
                      onClick={async () => {
                        if (!confirm(t('health.deleteConfirm', { hostname: r.hostname }))) return;
                        try {
                          await api.deleteDevice(r.deviceId);
                          setRows((prev) => prev.filter((x) => x.deviceId !== r.deviceId));
                        } catch (err) {
                          alert(t('health.deleteFailed') + ' ' + (err instanceof Error ? err.message : ''));
                        }
                      }}
                      className="rounded p-1 muted-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="td muted-2" colSpan={10}>{loading ? t('common.loading') : t('health.noMatch')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <HealthDetailPanel d={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function HealthDetailPanel({ d, onClose }: { d: DeviceHealthDetail; onClose: () => void }) {
  const { t, locale } = useT();
  const loc = bcp47(locale);
  const days = d.uptimeSec ? Math.floor(d.uptimeSec / 86400) : null;
  const [recent, setRecent] = useState<{ intervalStart: string; intervalSeconds: number; activeSeconds: number; foregroundApp: string | null; windowTitle: string | null; user: { displayName: string | null } | null }[] | null>(null);
  const [agentLog, setAgentLog] = useState<{ ts: string; message: string }[] | null>(null);
  useEffect(() => {
    api.deviceRecentIntervals(d.deviceId).then((r) => setRecent(r.intervals)).catch(() => setRecent([]));
    api.deviceAgentLog(d.deviceId).then((r) => setAgentLog(r.entries)).catch(() => setAgentLog([]));
    // Auto-obnova agent logu každých 10 s, dokud je panel otevřený
    const id = setInterval(() => {
      api.deviceAgentLog(d.deviceId).then((r) => setAgentLog(r.entries)).catch(() => undefined);
    }, 10_000);
    return () => clearInterval(id);
  }, [d.deviceId]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase muted-2">{d.manufacturer ?? '—'} {d.model ?? ''}</div>
            <h3 className="text-lg font-semibold">{d.hostname}</h3>
            {d.primaryUser && <div className="text-xs muted-2">{t('health.userLabel')}: {d.primaryUser}{d.primaryDepartment ? ` · ${d.primaryDepartment}` : ''}</div>}
            <div className="mt-1"><StatusBadge s={d.status} /></div>
          </div>
          <button onClick={onClose} className="muted-2 hover:text-red-500"><X size={18} /></button>
        </div>

        {d.issues.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="mb-1 font-medium">{t('health.issuesTitle')}</div>
            <ul className="list-disc space-y-0.5 pl-5">{d.issues.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
          </div>
        )}

        <Section title={t('health.sectionSystem')}>
          <KV label={t('common.os')} value={`${d.osName ?? '—'} ${d.osVersion ?? ''}`} />
          <KV label={t('health.uptimeLabel')} value={days !== null ? `${days} ${t('health.daysSuffix')}` : '—'} />
          <KV label={t('health.serialLabel')} value={d.serial ?? '—'} />
          <KV label={t('health.biosVersion')} value={`${d.biosVersion ?? '—'}${d.biosDate ? ` (${new Date(d.biosDate).toLocaleDateString(loc)})` : ''}`} />
        </Section>

        <Section title={t('health.sectionCpuMem')} icon={<Cpu size={14} />}>
          <KV label={t('health.cpuLabel')} value={d.cpuModel ?? '—'} />
          <KV label={t('health.cpuLoadLabel')} value={d.cpuLoadPct !== null ? `${d.cpuLoadPct} %` : '—'} />
          <KV label={t('health.ramTotalLabel')} value={d.ramTotalMB ? `${Math.round(d.ramTotalMB / 1024)} GB` : '—'} />
          <KV label={t('health.ramUsedLabel')} value={d.ramUsedPct !== null ? `${d.ramUsedPct} %` : '—'} />
        </Section>

        {d.batteryPresent && (
          <Section title={t('health.battery')} icon={<BatteryLow size={14} />}>
            <KV label={t('health.batteryChargeLabel')} value={d.batteryChargePct !== null ? `${d.batteryChargePct} %` : '—'} />
            <KV label={t('health.batteryHealthLabel')} value={d.batteryHealthPct !== null ? `${d.batteryHealthPct} %` : '—'} />
            <KV label={t('health.batteryCyclesLabel')} value={d.batteryCycles !== null ? `${d.batteryCycles}` : '—'} />
            <KV label={t('health.powerSourceLabel')} value={d.onAcPower ? t('health.powerAc') : t('health.powerBattery')} />
          </Section>
        )}

        <Section title={t('health.disks')} icon={<HardDrive size={14} />}>
          {d.disks.length === 0 && <div className="text-xs muted-2">{t('health.noDiskInfo')}</div>}
          {d.disks.map((disk, idx) => (
            <div key={idx} className="mb-2 rounded border border-gray-200 p-2 text-xs dark:border-slate-700">
              <div className="mb-1 flex items-center justify-between"><b>{disk.name}</b><span className={disk.smartStatus === 'OK' ? 'text-emerald-600' : 'text-red-500'}>SMART: {disk.smartStatus ?? '—'}</span></div>
              {disk.totalGB !== undefined && <div>{t('health.diskSpaceLabel')}: {disk.totalGB - (disk.freeGB ?? 0)} / {disk.totalGB} GB {t('health.diskUsedSuffix')}</div>}
              {disk.reallocSectors !== undefined && <div>{t('health.diskReallocLabel')}: <b className={disk.reallocSectors > 0 ? 'text-red-500' : ''}>{disk.reallocSectors}</b></div>}
              {disk.pendingSectors !== undefined && <div>{t('health.diskPendingLabel')}: <b className={disk.pendingSectors > 0 ? 'text-red-500' : ''}>{disk.pendingSectors}</b></div>}
              {disk.tempC !== undefined && <div>{t('health.diskTempLabel')}: {disk.tempC} °C</div>}
              {disk.powerOnHours !== undefined && <div>{t('health.diskRuntimeLabel')}: {Math.round(disk.powerOnHours / 24)} {t('health.daysSuffix')}</div>}
            </div>
          ))}
        </Section>

        <Section title={t('health.sectionSecurity')}>
          <KV label={t('health.antivirus')} value={d.antivirusEnabled === false ? t('health.avDisabledFull') : d.antivirusEnabled === true ? t('health.avEnabledFull') : '—'} />
          <KV label={t('health.avDefinitionsLabel')} value={d.antivirusUpdated === false ? t('health.avDefsOld') : d.antivirusUpdated === true ? t('health.avDefsNew') : '—'} />
          <KV label={t('health.pendingUpdates')} value={d.pendingUpdates !== null ? String(d.pendingUpdates) : '—'} />
          <KV label={t('health.pendingReboot')} value={d.rebootPending ? t('health.yesShort') : d.rebootPending === false ? t('health.noShort') : '—'} />
        </Section>

        <div className="mt-3 text-xs muted-2">{t('health.lastReport')}: {d.reportedAt ? new Date(d.reportedAt).toLocaleString(loc) : t('health.never')}</div>

        <Section title={t('health.agentLogTitle')}>
          <p className="mb-2 text-xs muted-2">{t('health.agentLogHint')}</p>
          {agentLog === null && <div className="text-xs muted-2">{t('common.loading')}</div>}
          {agentLog && agentLog.length === 0 && <div className="text-xs muted-2">{t('health.agentLogPlaceholder')}</div>}
          {agentLog && agentLog.length > 0 && (
            <div className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800/40">
              {agentLog.map((e, i) => {
                const isErr = e.message.includes('FAILED') || e.message.includes('EXCEPTION') || e.message.includes('Chybí');
                return (
                  <div key={i} className={`border-b border-gray-200 px-3 py-1 font-mono text-[11px] leading-relaxed last:border-b-0 dark:border-slate-700 ${isErr ? 'bg-red-50 dark:bg-red-500/10' : ''}`}>
                    <span className="tabular-nums text-gray-500">{e.ts.slice(11, 19)}</span>
                    <span className="ml-2 break-all">{e.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title={t('health.recentIntervalsHeader')}>
          <p className="mb-2 text-xs muted-2">{t('health.recentIntervalsHint')}</p>
          {recent === null && <div className="text-xs muted-2">{t('common.loading')}</div>}
          {recent && recent.length === 0 && <div className="text-xs muted-2">{t('health.recentIntervalsEmpty')}</div>}
          {recent && recent.length > 0 && (
            <div className="max-h-72 overflow-auto rounded border border-gray-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/40"><tr><th className="th">{t('health.colTime')}</th><th className="th">{t('health.colApp')}</th><th className="th">{t('health.colWindowTitle')}</th><th className="th text-right">{t('health.colActive')}</th></tr></thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} className="divide-row">
                      <td className="td tabular-nums">{new Date(r.intervalStart).toLocaleTimeString(loc)}</td>
                      <td className="td font-mono">{r.foregroundApp ?? '—'}</td>
                      <td className="td truncate max-w-[20ch]" title={r.windowTitle ?? ''}>{r.windowTitle ?? '—'}</td>
                      <td className="td text-right tabular-nums">{r.activeSeconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide muted-2">{icon}{title}</h4>
      <div className="space-y-0.5 text-sm">{children}</div>
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><span className="muted-2">{label}</span><span className="text-right">{value}</span></div>;
}
