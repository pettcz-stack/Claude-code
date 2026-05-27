import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from './api.js';

type Check = { id: string; title: string; status: 'pass' | 'warn' | 'fail'; detail: string; remediation?: string };

/**
 * Self-audit panel pro admina – ukazuje stav bezpečnostních zámků
 * (síla INGEST_TOKEN, NODE_ENV, per-device enrollment, demo data v DB,
 * retence, audit log, aktivní sessions). Admin do 30 vteřin uvidí,
 * jestli má instalaci dobře utaženou před nasazením na zákazníka.
 */
export function SecurityCheckPanel({ canEdit }: { canEdit: boolean }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.securityCheck();
      setChecks(r.checks);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canEdit) reload();
  }, [canEdit]);

  if (!canEdit) return null;

  const passes = checks?.filter((c) => c.status === 'pass').length ?? 0;
  const warns = checks?.filter((c) => c.status === 'warn').length ?? 0;
  const fails = checks?.filter((c) => c.status === 'fail').length ?? 0;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} className="text-emerald-600" />
          Bezpečnostní self-audit
        </h3>
        <button onClick={reload} disabled={loading} className="btn-ghost text-xs">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Obnovit
        </button>
      </div>
      <p className="mb-3 text-xs muted-2">
        Rychlý přehled stavu bezpečnostních zámků a GDPR pojistek na tomto serveru.
        Použij před otevřením přístupu zákazníkovi.
      </p>

      {error && <p className="text-sm text-red-500">Chyba: {error}</p>}

      {checks && (
        <>
          <div className="mb-3 flex gap-2 text-xs">
            {passes > 0 && <span className="chip-work">✓ {passes} OK</span>}
            {warns > 0 && <span className="chip-neutral">⚠ {warns} upozornění</span>}
            {fails > 0 && <span className="chip-nonwork">✗ {fails} problém{fails === 1 ? '' : 'y'}</span>}
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5">
                  {c.status === 'pass' && <CheckCircle2 size={16} className="text-emerald-600" />}
                  {c.status === 'warn' && <AlertTriangle size={16} className="text-amber-500" />}
                  {c.status === 'fail' && <XCircle size={16} className="text-red-600" />}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs muted-2">{c.detail}</div>
                  {c.remediation && (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      → {c.remediation}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
