import { useEffect, useState } from 'react';
import { HeartPulse, AlertTriangle, AlertOctagon, CheckCircle2, BatteryLow, HardDrive, Cpu, ShieldOff, RefreshCw, X } from 'lucide-react';
import { api, type DeviceHealthRow, type DeviceHealthDetail, type HealthStatus } from './api.js';

function statusBadge(s: HealthStatus) {
  if (s === 'CRITICAL') return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"><AlertOctagon size={12} /> Kritické</span>;
  if (s === 'WARN') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><AlertTriangle size={12} /> Pozor</span>;
  if (s === 'OK') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 size={12} /> V pořádku</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-slate-600/40 dark:text-slate-300">Nehlásí</span>;
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
          <span className="font-medium">Zdraví firemních počítačů</span>
          <span className="muted-2">– pro IT, aby vědělo o problému dřív než nastane</span>
        </div>
        <button onClick={load} className="btn-ghost text-xs"><RefreshCw size={13} /> Obnovit</button>
      </div>

      {/* Souhrn */}
      <div className="grid gap-3 sm:grid-cols-4">
        <button onClick={() => setFilter('CRITICAL')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-red-300 ${filter === 'CRITICAL' ? 'ring-2 ring-red-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">Kritické</div><div className="text-2xl font-bold text-red-500">{summary.critical}</div></div>
          <AlertOctagon size={28} className="text-red-400" />
        </button>
        <button onClick={() => setFilter('WARN')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-amber-300 ${filter === 'WARN' ? 'ring-2 ring-amber-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">Pozor</div><div className="text-2xl font-bold text-amber-500">{summary.warn}</div></div>
          <AlertTriangle size={28} className="text-amber-400" />
        </button>
        <button onClick={() => setFilter('OK')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-emerald-300 ${filter === 'OK' ? 'ring-2 ring-emerald-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">V pořádku</div><div className="text-2xl font-bold text-emerald-600">{summary.ok}</div></div>
          <CheckCircle2 size={28} className="text-emerald-400" />
        </button>
        <button onClick={() => setFilter('UNREPORTED')} className={`card flex items-center justify-between p-4 transition hover:ring-2 hover:ring-gray-300 ${filter === 'UNREPORTED' ? 'ring-2 ring-gray-400' : ''}`}>
          <div><div className="text-xs uppercase muted-2">Nehlásí</div><div className="text-2xl font-bold text-gray-500">{summary.unreported}</div></div>
          <HeartPulse size={28} className="text-gray-400" />
        </button>
      </div>

      {/* Filtr + hledání */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('ALL')} className={`btn-ghost text-xs ${filter === 'ALL' ? 'ring-1 ring-emerald-400' : ''}`}>Vše</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat hostname / uživatel / model…" className="field w-64" />
        <span className="text-xs muted-2">Zobrazeno {filtered.length} z {rows.length}</span>
      </div>

      {/* Tabulka */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-auto">
          <table className="w-full">
            <thead><tr className="text-left">
              <th className="th">Stav</th><th className="th">Hostname / Uživatel</th><th className="th">Model</th>
              <th className="th">Baterie</th><th className="th">Disk</th><th className="th">RAM</th>
              <th className="th">Aktual.</th><th className="th">Antivir</th><th className="th">Hlášky</th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.deviceId} className="divide-row cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5" onClick={() => api.deviceHealthDetail(r.deviceId).then(setOpen)}>
                  <td className="td">{statusBadge(r.status)}</td>
                  <td className="td">
                    <div className="font-medium">{r.hostname}</div>
                    {r.primaryUser && <div className="text-[11px] muted-2">{r.primaryUser}{r.primaryDepartment ? ` · ${r.primaryDepartment}` : ''}</div>}
                  </td>
                  <td className="td text-xs muted-2">{r.manufacturer ?? '—'} {r.model ?? ''}</td>
                  <td className="td">{batteryHealth(r.batteryHealthPct)}</td>
                  <td className="td">{pctBar(r.diskTopUsedPct, 85, 95)}</td>
                  <td className="td">{pctBar(r.ramUsedPct, 90, 95)}</td>
                  <td className="td text-xs tabular-nums">{r.pendingUpdates ?? '—'}</td>
                  <td className="td">{r.antivirusEnabled === false ? <span className="inline-flex items-center gap-1 text-red-500"><ShieldOff size={13} /> vyp.</span> : r.antivirusEnabled === true ? <span className="text-emerald-600">zap.</span> : <span className="muted-2">—</span>}</td>
                  <td className="td text-xs muted-2">{r.issues.length > 0 ? r.issues.slice(0, 2).join('; ') + (r.issues.length > 2 ? ` (+${r.issues.length - 2})` : '') : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td className="td muted-2" colSpan={9}>{loading ? 'Načítám…' : 'Nic neodpovídá filtru.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && <HealthDetailPanel d={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function HealthDetailPanel({ d, onClose }: { d: DeviceHealthDetail; onClose: () => void }) {
  const days = d.uptimeSec ? Math.floor(d.uptimeSec / 86400) : null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase muted-2">{d.manufacturer ?? '—'} {d.model ?? ''}</div>
            <h3 className="text-lg font-semibold">{d.hostname}</h3>
            {d.primaryUser && <div className="text-xs muted-2">Uživatel: {d.primaryUser}{d.primaryDepartment ? ` · ${d.primaryDepartment}` : ''}</div>}
            <div className="mt-1">{statusBadge(d.status)}</div>
          </div>
          <button onClick={onClose} className="muted-2 hover:text-red-500"><X size={18} /></button>
        </div>

        {d.issues.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="mb-1 font-medium">Co řešit</div>
            <ul className="list-disc space-y-0.5 pl-5">{d.issues.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
          </div>
        )}

        <Section title="Systém">
          <KV label="OS" value={`${d.osName ?? '—'} ${d.osVersion ?? ''}`} />
          <KV label="Uptime" value={days !== null ? `${days} dní` : '—'} />
          <KV label="Sériové číslo" value={d.serial ?? '—'} />
          <KV label="BIOS" value={`${d.biosVersion ?? '—'}${d.biosDate ? ` (${new Date(d.biosDate).toLocaleDateString('cs-CZ')})` : ''}`} />
        </Section>

        <Section title="CPU & paměť" icon={<Cpu size={14} />}>
          <KV label="Procesor" value={d.cpuModel ?? '—'} />
          <KV label="Vytížení CPU" value={d.cpuLoadPct !== null ? `${d.cpuLoadPct} %` : '—'} />
          <KV label="RAM celkem" value={d.ramTotalMB ? `${Math.round(d.ramTotalMB / 1024)} GB` : '—'} />
          <KV label="RAM využití" value={d.ramUsedPct !== null ? `${d.ramUsedPct} %` : '—'} />
        </Section>

        {d.batteryPresent && (
          <Section title="Baterie" icon={<BatteryLow size={14} />}>
            <KV label="Stav nabití" value={d.batteryChargePct !== null ? `${d.batteryChargePct} %` : '—'} />
            <KV label="Zdraví baterie" value={d.batteryHealthPct !== null ? `${d.batteryHealthPct} %` : '—'} />
            <KV label="Cykly" value={d.batteryCycles !== null ? `${d.batteryCycles}` : '—'} />
            <KV label="Napájení" value={d.onAcPower ? 'Síť (AC)' : 'Z baterie'} />
          </Section>
        )}

        <Section title="Disky" icon={<HardDrive size={14} />}>
          {d.disks.length === 0 && <div className="text-xs muted-2">Žádné informace.</div>}
          {d.disks.map((disk, idx) => (
            <div key={idx} className="mb-2 rounded border border-gray-200 p-2 text-xs dark:border-slate-700">
              <div className="mb-1 flex items-center justify-between"><b>{disk.name}</b><span className={disk.smartStatus === 'OK' ? 'text-emerald-600' : 'text-red-500'}>SMART: {disk.smartStatus ?? '—'}</span></div>
              {disk.totalGB !== undefined && <div>Místo: {disk.totalGB - (disk.freeGB ?? 0)} / {disk.totalGB} GB využito</div>}
              {disk.reallocSectors !== undefined && <div>Realokované sektory: <b className={disk.reallocSectors > 0 ? 'text-red-500' : ''}>{disk.reallocSectors}</b></div>}
              {disk.pendingSectors !== undefined && <div>Čekající vadné: <b className={disk.pendingSectors > 0 ? 'text-red-500' : ''}>{disk.pendingSectors}</b></div>}
              {disk.tempC !== undefined && <div>Teplota: {disk.tempC} °C</div>}
              {disk.powerOnHours !== undefined && <div>V provozu: {Math.round(disk.powerOnHours / 24)} dní</div>}
            </div>
          ))}
        </Section>

        <Section title="Bezpečnost & aktualizace">
          <KV label="Antivirus" value={d.antivirusEnabled === false ? 'VYPNUTÝ' : d.antivirusEnabled === true ? 'zapnutý' : '—'} />
          <KV label="Definice antiviru" value={d.antivirusUpdated === false ? 'staré' : d.antivirusUpdated === true ? 'aktuální' : '—'} />
          <KV label="Čekající aktualizace" value={d.pendingUpdates !== null ? String(d.pendingUpdates) : '—'} />
          <KV label="Čeká restart" value={d.rebootPending ? 'ano' : d.rebootPending === false ? 'ne' : '—'} />
        </Section>

        <div className="mt-3 text-xs muted-2">Poslední report: {d.reportedAt ? new Date(d.reportedAt).toLocaleString('cs-CZ') : 'nikdy'}</div>
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
