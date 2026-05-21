import { useEffect, useMemo, useState } from 'react';
import { api, type SelfReportData, type TipsData } from './api.js';
import { SelfReportView } from './SelfReportView.js';

type Data = { report: SelfReportData; tips: TipsData; modes: { funMode: boolean; healthMode: boolean; growthMode: boolean } };

/** Samostatná stránka reportu pro zaměstnance (bez přihlášení; token vázaný na jeho účet). */
export function EmployeeSelfReport({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
    const f = new Date(start); f.setDate(f.getDate() - 29);
    return { from: f.toISOString(), to: tomorrow.toISOString() };
  }, []);

  useEffect(() => {
    api.selfReportPublic(token, from, to).then(setData).catch(() => setError('Report není dostupný (odkaz vypršel nebo byl vypnut).'));
  }, [token, from, to]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-slate-900">
        <div className="card max-w-sm p-6 text-center">
          <div className="text-sm font-semibold">Report zatím nedostupný</div>
          <div className="mt-1 text-xs muted-2">{error}</div>
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
    </div>
  );
}
