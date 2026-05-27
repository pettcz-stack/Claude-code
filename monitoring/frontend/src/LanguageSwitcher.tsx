import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useT, LOCALES, type Locale } from './i18n/index.js';

/**
 * Přepínač jazyka – dropdown s vlajkami v hlavičce.
 * Volba se ukládá do localStorage (`focus_locale`), default detekce
 * z navigator.language nebo `cs` jako fallback.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Zavři dropdown při kliknutí mimo
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-800"
        aria-label={t('common.selectLanguage')}
        title={t('common.selectLanguage')}
      >
        <span className="text-base leading-none">{current.flag}</span>
        {!compact && <span className="text-xs font-medium">{current.code.toUpperCase()}</span>}
        <Globe size={14} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code as Locale); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{l.flag}</span>
                <span>{l.label}</span>
              </span>
              {l.code === locale && <Check size={14} className="text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
