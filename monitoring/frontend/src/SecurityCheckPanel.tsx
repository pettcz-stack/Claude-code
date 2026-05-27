import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from './api.js';
import { useT } from './i18n/index.js';

type Check = { id: string; title: string; status: 'pass' | 'warn' | 'fail'; detail: string; remediation?: string };

/**
 * Self-audit panel pro admina – ukazuje stav bezpečnostních zámků
 * (síla INGEST_TOKEN, NODE_ENV, per-device enrollment, demo data v DB,
 * retence, audit log, aktivní sessions). Admin do 30 vteřin uvidí,
 * jestli má instalaci dobře utaženou před nasazením na zákazníka.
 *
 * Titulky / detaily checků generuje server (lokalizace se zatím nepřekládá –
 * jsou to interní technické popisky, čte je admin/IT, ne zaměstnanec).
 */
export function SecurityCheckPanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useT();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try { setChecks((await api.securityCheck()).checks); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (canEdit) reload(); }, [canEdit]);

  if (!canEdit) return null;

  const passes = checks?.filter((c) => c.status === 'pass').length ?? 0;
  const warns = checks?.filter((c) => c.status === 'warn').length ?? 0;
  const fails = checks?.filter((c) => c.status === 'fail').length ?? 0;

  return (
    <section className="card p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t('securityCheck.title')}</h3>
            <p className="mt-0.5 text-xs muted-2">{t('securityCheck.subtitle')}</p>
          </div>
        </div>
        <button onClick={reload} disabled={loading} className="btn-ghost text-xs">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t('common.refresh')}
        </button>
      </header>

      {error && <p className="text-sm text-red-500">{t('common.error')}: {error}</p>}

      {checks && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {passes > 0 && <span className="chip-work">✓ {t('securityCheck.countsOk', { n: passes })}</span>}
            {warns > 0 && <span className="chip-neutral">⚠ {t('securityCheck.countsWarn', { n: warns })}</span>}
            {fails > 0 && <span className="chip-nonwork">✗ {t('securityCheck.countsFail', { n: fails })}</span>}
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 shrink-0">
                  {c.status === 'pass' && <CheckCircle2 size={16} className="text-emerald-600" />}
                  {c.status === 'warn' && <AlertTriangle size={16} className="text-amber-500" />}
                  {c.status === 'fail' && <XCircle size={16} className="text-red-600" />}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs muted-2">{c.detail}</div>
                  {c.remediation && (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      {t('securityCheck.remediationPrefix')} {c.remediation}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
