import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Copy, Trash2, FileText, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { api } from './api.js';
import { useToast } from './Toast.js';
import { useT } from './i18n/index.js';

type EventLevel = 'info' | 'warn' | 'error';
interface AppEvent {
  ts: string;
  level: EventLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const REFRESH_MS = 5000;

/**
 * Diagnostický log – posledních ~500 zajímavých událostí backendu.
 * Drží se jen v paměti procesu, vyfoť a pošli vývojáři, když něco selže.
 */
export function DiagnosticLog({ canEdit }: { canEdit: boolean }) {
  const { t } = useT();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [level, setLevel] = useState<EventLevel | 'all'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    api.events({ level: level === 'all' ? undefined : level, limit: 200 })
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [level]);

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load, autoRefresh]);

  function copyAll() {
    const text = events.map((e) => `${e.ts} [${e.level.toUpperCase()}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text).then(
      () => toast(t('diagnostics.copied', { n: events.length })),
      () => toast(t('diagnostics.copyFailed'), 'error'),
    );
  }
  async function clearAll() {
    if (!confirm(t('diagnostics.confirmClear'))) return;
    await api.clearEvents().catch(() => undefined);
    load();
  }

  const counts = { error: 0, warn: 0, info: 0 };
  for (const e of events) counts[e.level]++;

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-emerald-600" /> {t('diagnostics.title')}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="muted-2">{t('diagnostics.countsErrors', { n: counts.error })} · {t('diagnostics.countsWarnings', { n: counts.warn })} · {t('diagnostics.countsInfo', { n: counts.info })}</span>
          <button onClick={load} className="btn-ghost" title={t('diagnostics.refresh')}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={copyAll} className="btn-ghost" title={t('diagnostics.copyAll')}><Copy size={13} /></button>
          {canEdit && <button onClick={clearAll} className="btn-ghost text-red-500" title={t('diagnostics.deleteAll')}><Trash2 size={13} /></button>}
        </div>
      </div>

      <p className="mb-3 text-xs muted-2">
        {t('diagnostics.intro')}
      </p>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="muted-2">{t('diagnostics.filter')}</span>
        {(['all', 'error', 'warn', 'info'] as const).map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`rounded-full border px-2 py-0.5 ${level === l ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-gray-300 dark:border-slate-600'}`}>{l === 'all' ? t('diagnostics.levelAll') : l}</button>
        ))}
        <label className="ml-3 flex cursor-pointer items-center gap-1 muted-2">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          {t('diagnostics.autoRefresh')}
        </label>
      </div>

      <div className="max-h-96 overflow-auto rounded border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800/40">
        {events.length === 0 && (
          <div className="p-4 text-center text-sm muted-2">{loading ? t('diagnostics.loading') : t('diagnostics.empty')}</div>
        )}
        {events.map((e, i) => (
          <div key={i} className={`flex items-start gap-2 border-b border-gray-200 px-3 py-1.5 font-mono text-xs leading-relaxed last:border-b-0 dark:border-slate-700 ${e.level === 'error' ? 'bg-red-50 dark:bg-red-500/10' : e.level === 'warn' ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
            <span className="shrink-0">{e.level === 'error' ? <AlertOctagon size={13} className="mt-0.5 text-red-500" /> : e.level === 'warn' ? <AlertTriangle size={13} className="mt-0.5 text-amber-500" /> : <Info size={13} className="mt-0.5 text-gray-400" />}</span>
            <span className="shrink-0 tabular-nums text-gray-500">{e.ts.slice(11, 19)}</span>
            <span className="break-all">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
