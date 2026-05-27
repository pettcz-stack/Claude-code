import { useEffect, useState } from 'react';
import { Laptop2, LogOut } from 'lucide-react';
import { api } from './api.js';
import { useT, type Locale } from './i18n/index.js';

type Sess = { id: string; createdAt: string; expiresAt: string; lastUsedAt: string; isCurrent: boolean };

const LOCALE_TO_BCP47: Record<Locale, string> = {
  cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB', pl: 'pl-PL', de: 'de-DE',
};

export function SessionsPanel() {
  const { t, locale } = useT();
  const bcp47 = LOCALE_TO_BCP47[locale];
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try { setSessions((await api.mySessions()).sessions); }
    catch (e) { setError(String(e)); }
  }
  useEffect(() => { reload(); }, []);

  async function revoke(id: string) {
    if (!window.confirm(t('sessions.revokeConfirm'))) return;
    try { await api.revokeSession(id); reload(); }
    catch (e) { setError(String(e)); }
  }

  return (
    <section className="card p-6">
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Laptop2 size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t('sessions.title')}</h3>
          <p className="mt-0.5 text-xs muted-2">{t('sessions.subtitle')}</p>
        </div>
      </header>

      {error && <p className="text-sm text-red-500">{t('common.error')}: {error}</p>}
      {sessions && sessions.length === 0 && <p className="text-sm muted-2">{t('sessions.empty')}</p>}
      {sessions && sessions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t('sessions.columnStatus')}</th>
                <th className="th">{t('sessions.columnCreated')}</th>
                <th className="th">{t('sessions.columnLastUsed')}</th>
                <th className="th">{t('sessions.columnExpires')}</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="divide-row">
                  <td className="td">
                    {s.isCurrent
                      ? <span className="chip-work">{t('sessions.badgeCurrent')}</span>
                      : <span className="chip-neutral">{t('sessions.badgeOther')}</span>}
                  </td>
                  <td className="td text-xs tabular-nums">{new Date(s.createdAt).toLocaleString(bcp47)}</td>
                  <td className="td text-xs tabular-nums">{new Date(s.lastUsedAt).toLocaleString(bcp47)}</td>
                  <td className="td text-xs tabular-nums muted-2">{new Date(s.expiresAt).toLocaleString(bcp47)}</td>
                  <td className="td text-right">
                    {!s.isCurrent && (
                      <button onClick={() => revoke(s.id)} className="btn-ghost text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <LogOut size={13} /> {t('sessions.revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
