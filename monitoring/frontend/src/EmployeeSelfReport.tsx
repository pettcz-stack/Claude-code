import { useEffect, useMemo, useState } from 'react';
import { Eye, Download } from 'lucide-react';
import { api, type SelfReportData, type TipsData } from './api.js';
import { SelfReportView } from './SelfReportView.js';
import { useT, type Locale } from './i18n/index.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';

type AuditRow = { id: string; adminIdentity: string; action: string; detail: string | null; createdAt: string };

type Data = { report: SelfReportData; tips: TipsData; modes: { funMode: boolean; healthMode: boolean; growthMode: boolean } };

const LOCALE_TO_BCP47: Record<Locale, string> = {
  cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB', pl: 'pl-PL', de: 'de-DE',
};

/** Samostatná stránka reportu pro zaměstnance (bez přihlášení; token vázaný na jeho účet). */
export function EmployeeSelfReport({ token }: { token: string }) {
  const { t, locale } = useT();
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
      const msg = e.message || '';
      if (msg.includes('404')) setError(t('selfReport.error404'));
      else if (msg.includes('401')) setError(t('selfReport.error401'));
      else if (msg.includes('403')) setError(t('selfReport.error403'));
      else setError(t('selfReport.errorGeneric'));
    });
    api.selfAudit(token).then(setAudit).catch(() => setAudit({ enabled: false, rows: [] }));
  }, [token, from, to, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-slate-900">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>
        <div className="card max-w-md p-7 text-center">
          <div className="mb-3 text-3xl">🙏</div>
          <div className="text-base font-semibold">{t('selfReport.reportUnavailable')}</div>
          <div className="mt-3 text-sm muted-2">{error}</div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-slate-900">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-emerald-500" />
        <div className="text-sm muted-2">{t('selfReport.loading')}</div>
      </div>
    );
  }

  const bcp47 = LOCALE_TO_BCP47[locale];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Sticky header s názvem reportu + jazykový přepínač */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold leading-tight">FOCUS · {t('selfReport.pageTitle')}</h1>
            <p className="text-xs muted-2">{t('selfReport.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="py-6">
        <SelfReportView from={from} to={to} preloaded={data} />

        {/* GDPR čl. 20 – stažení všech vlastních dat. */}
        <div className="mx-auto mt-4 max-w-5xl px-4">
          <button
            onClick={() => api.selfExport(token).catch((e) => alert(t('selfReport.downloadFailed') + ': ' + e))}
            className="btn-ghost text-xs"
            title={t('selfReport.downloadAllHint')}
          >
            <Download size={14} /> {t('selfReport.downloadAll')}
          </button>
        </div>

        {audit?.enabled && (
          <div className="mx-auto mt-6 max-w-5xl px-4">
            <div className="card p-5">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Eye size={16} className="text-emerald-600" /> {t('selfReport.whoLooked')}
              </h3>
              <p className="mb-3 text-xs muted-2">{t('selfReport.whoLookedHint')}</p>
              {audit.rows.length === 0 && <div className="text-sm muted-2">{t('selfReport.whoLookedEmpty')}</div>}
              {audit.rows.length > 0 && (
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="th">{t('selfReport.when')}</th>
                        <th className="th">{t('selfReport.who')}</th>
                        <th className="th">{t('selfReport.what')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.rows.map((a) => (
                        <tr key={a.id} className="divide-row">
                          <td className="td tabular-nums text-xs">{new Date(a.createdAt).toLocaleString(bcp47)}</td>
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
      </main>
    </div>
  );
}
