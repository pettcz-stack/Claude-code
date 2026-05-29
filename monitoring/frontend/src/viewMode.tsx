import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * View mode — Basic vs Pro. Některý admin chce vidět jen pár klíčových
 * ukazatelů (Basic = manažer), jiný chce do hloubky (Pro = auditor / DPO).
 *
 * Persistence:
 *  1) localStorage per browser (rychlé, primární storage)
 *  2) backend sync NA EXPLICITNÍ ZMĚNU od uživatele (cross-device sync)
 *     – nesyncujeme na initial mount default hodnoty (jinak spam 401 v
 *     diagnostickém logu pro nepřihlášené uživatele)
 *
 * Backend sync je best-effort: pokud user není přihlášený (401) nebo backend
 * nedostupný (network), zůstane jen v localStorage.
 */

export type ViewMode = 'basic' | 'pro';

type ViewModeCtx = {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  isBasic: boolean;
  isPro: boolean;
};

const Ctx = createContext<ViewModeCtx>({
  viewMode: 'pro',
  setViewMode: () => undefined,
  isBasic: false,
  isPro: true,
});

const STORAGE_KEY = 'focus_view_mode';

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'basic' || stored === 'pro' ? stored : 'pro';
  });
  // Track jestli to byla uživatelská změna (vs initial mount). Bez tohoto
  // by useEffect na mount syncoval default na backend → 401 pro nepřihlášené.
  const userTouched = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
    if (!userTouched.current) return; // skip initial mount
    fetch('/api/v1/account/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewMode }),
    }).catch(() => undefined);
  }, [viewMode]);

  const setViewMode = (v: ViewMode) => {
    userTouched.current = true;
    setViewModeState(v);
  };

  const value: ViewModeCtx = {
    viewMode,
    setViewMode,
    isBasic: viewMode === 'basic',
    isPro: viewMode === 'pro',
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewMode() {
  return useContext(Ctx);
}
