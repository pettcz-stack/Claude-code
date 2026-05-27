import { useEffect, useState } from 'react';
import { Mail, Save, MessageSquareWarning, Download, UserX } from 'lucide-react';
import { api, type AdminUserRow, type AuditRow, type ClaimRow, type Device } from './api.js';
import { useT } from './i18n/index.js';

export function AdminView({ role }: { role: string }) {
  const { t } = useT();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const isAdmin = role === 'ADMIN';

  function loadAll() {
    api.devices().then(setDevices).catch((e) => setError(String(e)));
    if (isAdmin) {
      api.adminUsers().then(setUsers).catch(() => undefined);
      api.audit().then(setAudit).catch(() => undefined);
      api.adminClaims().then(setClaims).catch(() => undefined);
    }
  }
  useEffect(loadAll, [role]);

  async function resolveClaim(c: ClaimRow, type: string) {
    await api.resolveClaim(c.id, { type, category: type === 'NON_WORK' ? 'Zábava' : 'Pracovní' }).catch(() => undefined);
    loadAll();
  }

  async function triggerReport() {
    setReportMsg('Odesílám…');
    const r = await api.sendReport();
    setReportMsg(r.ok ? `Report odeslán (${r.rows} řádků, ${r.recipients} příjemců).` : `Chyba: ${r.error}`);
  }
  async function toggleDevice(d: Device) { await api.patchDevice(d.id, !d.active).catch((e) => setError(String(e))); loadAll(); }
  async function saveUser(u: AdminUserRow) { await api.patchUser(u.id, { displayName: u.displayName ?? '', department: u.department ?? '', active: u.active, hourlyRate: u.hourlyRate }).catch((e) => setError(String(e))); loadAll(); }
  function patchLocalUser(id: string, patch: Partial<AdminUserRow>) { setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u))); }
  async function exportUser(u: AdminUserRow) {
    try { await api.exportUser(u.id); } catch (e) { setError(String(e)); }
  }
  async function eraseUser(u: AdminUserRow) {
    const name = u.displayName ?? u.id;
    const title = t('gdpr.deletePromptTitle', { name });
    const keyword = t('gdpr.deletePromptKeyword');
    const confirmation = window.prompt(`${title}\n\n${t('gdpr.deletePromptBody')}`);
    if (confirmation !== keyword) return;
    try {
      const r = await api.eraseUser(u.id);
      alert(t('gdpr.deleteDone') + Object.entries(r.deleted).map(([k, v]) => `${k}=${v}`).join(', '));
      loadAll();
    } catch (e) { setError(String(e)); }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">Zařízení (stav agentů)</h3>
        {error && <p className="text-sm text-red-500">Chyba: {error}</p>}
        <table className="w-full">
          <thead><tr><th className="th">Stav</th><th className="th">Hostname</th><th className="th">OS</th><th className="th">Verze</th><th className="th">Poslední kontakt</th>{isAdmin && <th className="th">Sledování</th>}</tr></thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="divide-row">
                <td className="td"><span className={`inline-block h-2.5 w-2.5 rounded-full ${d.online ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`} /></td>
                <td className="td font-medium">{d.hostname}</td>
                <td className="td muted">{d.os ?? '—'}</td>
                <td className="td muted">{d.agentVersion ?? '—'}</td>
                <td className="td muted-2">{d.lastSeen ? new Date(d.lastSeen).toLocaleString('cs-CZ') : '—'}</td>
                {isAdmin && <td className="td"><button onClick={() => toggleDevice(d)} className={d.active ? 'chip-work' : 'chip-neutral'}>{d.active ? 'Aktivní' : 'Pozastaveno'}</button></td>}
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="td py-6 text-center muted-2">Žádná zařízení.</td></tr>}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Sledovaní uživatelé</h3>
          <p className="mb-2 text-xs muted-2">Zařazení do oddělení ovlivňuje filtrování v dashboardu a pravidla podle oddělení (např. LinkedIn = práce jen pro HR). Klikni do pole „Oddělení" a vyber z nabídky nebo napiš vlastní název.</p>
          {/* Sjednocený seznam: přednastavené + již používané oddělení (bez duplikátů). */}
          <datalist id="dept-list">
            {Array.from(new Set([
              'HR', 'Personalistika', 'Nábor',
              'IT', 'Vývoj', 'Konstrukce',
              'Výroba', 'Údržba', 'Kvalita / QA',
              'Marketing', 'Obchod', 'Obchod Export',
              'Nákup', 'Logistika', 'Sklad',
              'Ekonomika', 'Účetnictví', 'Finance',
              'Vedení', 'Asistence', 'Právní',
              ...users.map((u) => u.department ?? '').filter(Boolean),
            ])).sort((a, b) => a.localeCompare(b, 'cs')).map((d) => <option key={d} value={d} />)}
          </datalist>
          <table className="w-full">
            <thead><tr><th className="th">Jméno</th><th className="th">Oddělení</th><th className="th">Mzda Kč/h</th><th className="th">Aktivní</th><th className="th"></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="divide-row">
                  <td className="td"><input value={u.displayName ?? ''} onChange={(e) => patchLocalUser(u.id, { displayName: e.target.value })} className="field w-full" /></td>
                  <td className="td"><input list="dept-list" value={u.department ?? ''} placeholder="vyber nebo napiš…" onChange={(e) => patchLocalUser(u.id, { department: e.target.value })} className="field w-full" /></td>
                  <td className="td"><input type="number" value={u.hourlyRate ?? ''} onChange={(e) => patchLocalUser(u.id, { hourlyRate: e.target.value ? Number(e.target.value) : null })} className="field w-24 text-right" /></td>
                  <td className="td"><input type="checkbox" checked={u.active} onChange={(e) => patchLocalUser(u.id, { active: e.target.checked })} /></td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => saveUser(u)} className="btn-ghost" title="Uložit změny"><Save size={14} /> Uložit</button>
                      <button onClick={() => exportUser(u)} className="btn-ghost" title={t('gdpr.exportTooltip')}><Download size={14} /></button>
                      <button onClick={() => eraseUser(u)} className="btn-ghost text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('gdpr.eraseTooltip')}><UserX size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs muted-2">Mzda (Kč/h) slouží k výpočtu ceny neproduktivního času v záložce „Software & náklady".</p>
        </div>
      )}

      {isAdmin && claims.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquareWarning size={16} className="text-amber-500" /> Reklamace klasifikace</h3>
          <table className="w-full">
            <thead><tr><th className="th">Cíl</th><th className="th">Typ cíle</th><th className="th">Návrh zaměstnance</th><th className="th">Poznámka</th><th className="th">Stav</th><th className="th"></th></tr></thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="divide-row">
                  <td className="td font-mono text-xs">{c.target}</td>
                  <td className="td muted">{c.targetKind === 'TITLE' ? 'web/titulek' : 'aplikace'}</td>
                  <td className="td">{c.suggested === 'WORK' ? 'práce' : 'zábava'}</td>
                  <td className="td muted">{c.note ?? '—'}</td>
                  <td className="td">{c.status === 'OPEN' ? 'otevřená' : 'vyřízená'}</td>
                  <td className="td text-right">
                    {c.status === 'OPEN' && (
                      <span className="flex justify-end gap-1">
                        <button onClick={() => resolveClaim(c, 'WORK')} className="chip-work">práce</button>
                        <button onClick={() => resolveClaim(c, 'NON_WORK')} className="chip-nonwork">zábava</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">E-mailový report</h3>
          <div className="flex items-center gap-3">
            <button onClick={triggerReport} className="btn-primary"><Mail size={15} /> Odeslat report nyní</button>
            {reportMsg && <span className="text-sm muted">{reportMsg}</span>}
          </div>
          <p className="mt-1 text-xs muted-2">Vyžaduje nastavený SMTP a příjemce. Plánovaně dle REPORT_CRON.</p>
        </div>
      )}

      {isAdmin && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Audit přístupů (GDPR)</h3>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead><tr><th className="th">Čas</th><th className="th">Uživatel</th><th className="th">Akce</th><th className="th">Detail</th></tr></thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="divide-row">
                    <td className="td muted-2">{new Date(a.createdAt).toLocaleString('cs-CZ')}</td>
                    <td className="td">{a.adminIdentity}</td>
                    <td className="td">{a.action}</td>
                    <td className="td muted">{a.detail}</td>
                  </tr>
                ))}
                {audit.length === 0 && <tr><td colSpan={4} className="td py-6 text-center muted-2">Zatím žádné záznamy.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
