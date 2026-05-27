import { useEffect, useState } from 'react';
import { Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react';
import { RELEASES, CURRENT_VERSION, shouldShowReleaseBanner, markReleaseSeen } from './releases.js';
import { useT } from './i18n/index.js';

/**
 * Po update FOCUS se uživateli zobrazí 1× banner s přehledem novinek pro
 * aktuální verzi. Po zavření / kliknutí Rozumím se uloží `focus_seen_version`
 * a banner i všechny `<NewBadge />` zmizí.
 */
export function WhatsNewBanner() {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setShow(shouldShowReleaseBanner());
  }, []);

  if (!show) return null;
  const release = RELEASES[0];

  function dismiss() {
    markReleaseSeen();
    setShow(false);
    // Page reload tak, aby <NewBadge /> komponenty znovu vyhodnotily isNew.
    // Bez toho zůstanou NEW badges svítit, dokud user neudělá refresh sám.
    window.location.reload();
  }

  return (
    <div className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 dark:border-emerald-700/40 dark:from-emerald-900/15 dark:to-sky-900/15">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white">
          <Sparkles size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {t('whatsNew.title', { v: release.version })}
            </span>
            <span className="text-xs muted-2">· {release.title}</span>
          </div>
          {!expanded ? (
            <button onClick={() => setExpanded(true)} className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400">
              <ChevronDown size={12} /> {t('whatsNew.showHighlights', { n: release.highlights.length })}
            </button>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-xs">
                {release.highlights.map((h, i) => (
                  <li key={i} className="flex gap-1.5">
                    <Sparkles size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => setExpanded(false)} className="mt-2 inline-flex items-center gap-1 text-xs muted-2 hover:underline">
                <ChevronUp size={12} /> {t('whatsNew.collapse')}
              </button>
            </>
          )}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
          aria-label={t('whatsNew.dismiss')}
          title={t('whatsNew.dismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Panel se seznamem posledních releasů – dostupný z UserMenu.
 * Pro detailní browsing historii.
 */
export function WhatsNewPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles size={16} className="text-emerald-500" /> {t('whatsNew.panelTitle')}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-6">
          {RELEASES.slice(0, 5).map((r) => (
            <div key={r.version}>
              <div className="flex items-baseline gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${r.version === CURRENT_VERSION ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  v{r.version}
                </span>
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="ml-auto text-xs muted-2">{r.date}</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="border-t border-gray-200 pt-3 text-center text-xs muted-2 dark:border-slate-700">
            {t('whatsNew.fullChangelogLink')}{' '}
            <a href="https://github.com/pettcz-stack/claude-code/blob/claude/employee-monitoring-app-LPmRD/monitoring/CHANGELOG.md" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">CHANGELOG.md</a>
          </p>
        </div>
      </div>
    </div>
  );
}
