import { useEffect, useState } from 'react';
import { api, type AdminUserRow, type AuditRow, type Device } from './api.js';

export function AdminView({ role }: { role: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const isAdmin = role === 'ADMIN';

  function loadAll() {
    api.devices().then(setDevices).catch((e) => setError(String(e)));
    if (isAdmin) {
      api.adminUsers().then(setUsers).catch(() => undefined);
      api.audit().then(setAudit).catch(() => undefined);
    }
  }

  useEffect(loadAll, [role]);

  async function triggerReport() {
    setReportMsg('Odesílám…');
    const r = await api.sendReport();
    setReportMsg(r.ok ? `Report odeslán (${r.rows} řádků, ${r.recipients} příjemců).` : `Chyba: ${r.error}`);
  }

  async function toggleDevice(d: Device) {
    await api.patchDevice(d.id, !d.active).catch((e) => setError(String(e)));
    loadAll();
  }

  async function saveUser(u: AdminUserRow) {
    await api
      .patchUser(u.id, { displayName: u.displayName ?? '', department: u.department ?? '', active: u.active })
      .catch((e) => setError(String(e)));
    loadAll();
  }

  function patchLocalUser(id: string, patch: Partial<AdminUserRow>) {
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Zařízení (stav agentů)</h2>
        {error && <p className="text-sm text-red-600">Chyba: {error}</p>}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Stav</th>
                <th className="px-3 py-2">Hostname</th>
                <th className="px-3 py-2">OS</th>
                <th className="px-3 py-2">Verze agenta</th>
                <th className="px-3 py-2">Poslední kontakt</th>
                {isAdmin && <th className="px-3 py-2">Sledování</th>}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${d.online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800">{d.hostname}</td>
                  <td className="px-3 py-2 text-gray-600">{d.os ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{d.agentVersion ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{d.lastSeen ? new Date(d.lastSeen).toLocaleString('cs-CZ') : '—'}</td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleDevice(d)}
                        className={`rounded px-2 py-1 text-xs ${d.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {d.active ? 'Aktivní' : 'Pozastaveno'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-3 py-6 text-center text-gray-400">Žádná zařízení.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Sledovaní uživatelé</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">Jméno</th>
                  <th className="px-3 py-2">Oddělení</th>
                  <th className="px-3 py-2">Aktivní</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <input
                        value={u.displayName ?? ''}
                        onChange={(e) => patchLocalUser(u.id, { displayName: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={u.department ?? ''}
                        onChange={(e) => patchLocalUser(u.id, { department: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={u.active}
                        onChange={(e) => patchLocalUser(u.id, { active: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => saveUser(u)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
                        Uložit
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-400">Žádní uživatelé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isAdmin && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">E-mailový report</h2>
          <div className="flex items-center gap-3">
            <button onClick={triggerReport} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
              Odeslat report nyní
            </button>
            {reportMsg && <span className="text-sm text-gray-600">{reportMsg}</span>}
          </div>
          <p className="mt-1 text-xs text-gray-400">Vyžaduje nastavený SMTP a příjemce (REPORT_RECIPIENTS). Plánovaně dle REPORT_CRON.</p>
        </section>
      )}

      {isAdmin && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Audit přístupů (GDPR)</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">Čas</th>
                  <th className="px-3 py-2">Uživatel</th>
                  <th className="px-3 py-2">Akce</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-500">{new Date(a.createdAt).toLocaleString('cs-CZ')}</td>
                    <td className="px-3 py-2 text-gray-700">{a.adminIdentity}</td>
                    <td className="px-3 py-2">{a.action}</td>
                    <td className="px-3 py-2 text-gray-500">{a.detail}</td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-400">Zatím žádné záznamy.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
