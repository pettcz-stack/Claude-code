import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { api, type SelfReportData, type TipsData } from './api.js';
import { SelfReportView } from './SelfReportView.js';

type AuditRow = { id: string; adminIdentity: string; action: string; detail: string | null; createdAt: string };

type Data = { report: SelfReportData; tips: TipsData; modes: { funMode: boolean; healthMode: boolean; growthMode: boolean } };

/** Samostatná stránka reportu pro zaměstnance (bez přihlášení; token vázaný na jeho účet). */
export function EmployeeSelfReport({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [audit, setAudit] = useState<{ enabled: boolean; rows: AuditRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
    const f = new Date(start); f.setDate(f.getDate() - 29);
    return { from: f.toISOString(), to: tomorrow.toISOString() };
  }, []);

  useEffect(() => {
    api.selfReportPublic(token, from, to).then(setData).catch((e: Error) => {
      // Chybové kódy ze serveru: 403:disabled · 401:invalid_token · 404:not_found
      const msg = e.message || '';
      if (msg.includes('404')) setError('Tvoje data ještě nedorazila na server. Agent se rozjíždí — zkus znovu za pár minut.');
      else if (msg.includes('401')) setError('Odkaz vypršel nebo je neplatný. Otevři report znovu z ikonky v liště (pravým → Otevřít můj report).');
      else if (msg.includes('403')) setError('Report pro zaměstnance je vypnutý v administraci. Požádej IT / vedení o zapnutí.');
      else setError('Report se nepodařilo načíst. Zkus to za chvíli znovu.');
    });
    api.selfAudit(token).then(setAudit).catch(() => setAudit({ enabled: false, rows: [] }));
  }, [token, from, to]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-slate-900">
        <div className="card max-w-md p-6 text-center">
          <div className="mb-2 text-2xl">🙏</div>
          <div className="text-sm font-semibold">FOCUS – report zatím nedostupný</div>
          <div className="mt-2 text-xs muted-2">{error}</div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-slate-900">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-200 border-t-emerald-500" />
        <div className="text-sm muted-2">Načítám tvůj report…</div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 py-6 dark:bg-slate-900">
      <SelfReportView from={from} to={to} preloaded={data} />
      {audit?.enabled && (
        <div className="mx-auto mt-6 max-w-5xl px-4">
          <div className="card p-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Eye size={16} className="text-emerald-600" /> Kdo se na moje data díval</h3>
            <p className="mb-3 text-xs muted-2">Transparentní výpis přístupů ke tvým datům (posledních 200 záznamů). Pokud něco nesedí, ozvi se vedení / DPO.</p>
            {audit.rows.length === 0 && <div className="text-sm muted-2">Zatím se na tvoje data nikdo nedíval.</div>}
            {audit.rows.length > 0 && (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr><th className="th">Kdy</th><th className="th">Kdo</th><th className="th">Co</th></tr></thead>
                  <tbody>
                    {audit.rows.map((a) => (
                      <tr key={a.id} className="divide-row">
                        <td className="td tabular-nums text-xs">{new Date(a.createdAt).toLocaleString('cs-CZ')}</td>
                        <td className="td">{a.adminIdentity}</td>
                        <td className="td text-xs">{a.action}{a.detail ? ` — ${a.detail}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
