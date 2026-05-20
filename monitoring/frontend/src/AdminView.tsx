import { useEffect, useState } from 'react';
import { api, type AuditRow, type Device } from './api.js';

export function AdminView({ role }: { role: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.devices().then(setDevices).catch((e) => setError(String(e)));
    if (role === 'ADMIN') api.audit().then(setAudit).catch(() => undefined);
  }, [role]);

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
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">Žádná zařízení.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {role === 'ADMIN' && (
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
