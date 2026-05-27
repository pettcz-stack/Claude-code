/**
 * Lehký i18n systém pro FOCUS – bez závislosti na react-i18next nebo dalších
 * lib. Slovník je plain TypeScript objekt (typesafe – kompiler vynutí, aby
 * každý jazyk měl stejné klíče jako čeština / "master locale").
 *
 * Použití:
 *   const { t, locale, setLocale } = useT();
 *   <button>{t('common.save')}</button>
 *
 * Interpolace:
 *   t('counts.users', { n: 42 })   // "42 uživatelů"
 *
 * Přidání nového jazyka: vytvoř soubor `i18n/<kod>.ts`, exportuj objekt
 * stejné struktury jako `cs.ts`, přidej do `LOCALES` v této souboru.
 */
import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { cs } from './cs.js';
import { en } from './en.js';
import { pl } from './pl.js';
import { de } from './de.js';
import { sk } from './sk.js';

export type Locale = 'cs' | 'en' | 'pl' | 'de' | 'sk';

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', label: 'Slovenčina', flag: '🇸🇰' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const DICTS = { cs, en, pl, de, sk } as const;

// Klíče slovníku jsou stromová cesta typu "settings.title" – `get` je dohledá.
// `cs` je master locale a slouží jako typový template – ostatní jazyky se
// proti němu kontrolují v `<Dict>` parametru.
type Dict = typeof cs;

function get(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

interface I18nContext {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const I18nCtx = createContext<I18nContext | null>(null);

const STORAGE_KEY = 'focus_locale';

function detectInitialLocale(): Locale {
  const stored = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as Locale | null;
  if (stored && stored in DICTS) return stored;
  // Detekce z prohlížeče (browser locale)
  if (typeof navigator !== 'undefined') {
    const navLang = (navigator.language || 'cs').slice(0, 2).toLowerCase() as Locale;
    if (navLang in DICTS) return navLang;
  }
  return 'cs';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* private mode */ }
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContext>(() => {
    const dict = DICTS[locale];
    return {
      locale,
      setLocale: (l: Locale) => setLocaleState(l),
      t: (key: string, vars?: Record<string, string | number>) => {
        // 1. Zkus aktivní jazyk
        const hit = get(dict, key);
        if (hit) return interpolate(hit, vars);
        // 2. Fallback na češtinu (master)
        const fallback = get(cs as Dict, key);
        if (fallback) return interpolate(fallback, vars);
        // 3. Vrať klíč (vývojářské upozornění, že chybí překlad)
        return key;
      },
    };
  }, [locale]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT(): I18nContext {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}
