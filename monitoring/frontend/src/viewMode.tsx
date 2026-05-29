import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * View mode — Basic vs Pro. Některý admin chce vidět jen pár klíčových
 * ukazatelů (Basic = manažer), jiný chce do hloubky (Pro = auditor / DPO).
 *
 * Basic režim skrývá:
 *  - Detailní KPI dlaždice (jen Score + Aktivní práce + Online)
 *  - Pokročilé alert typy (jen High severity)
 *  - Sekce Software & náklady detail (jen Top 3 nákladové)
 *  - Heatmap fine-grained breakdown
 *  - Per-app drill-downy v Top aplikace
 *
 * Pro režim zobrazuje všechno (současný defaultní stav).
 *
 * Persistence: localStorage per browser (rychlé), volitelně sync s backend
 * AdminUser.viewMode pro per-account preferenci napříč zařízeními.
 * Backend sync proběhne lazy při save - pokud failnem (offline), zůstane jen v localStorage.
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
    // Best-effort sync s backend account preferencí. Pokud nemáme přihlášeného
    // user nebo backend nedostupný, je to OK – localStorage je primární storage.
    fetch('/api/v1/account/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewMode }),
    }).catch(() => undefined);
  }, [viewMode]);

  const value: ViewModeCtx = {
    viewMode,
    setViewMode: setViewModeState,
    isBasic: viewMode === 'basic',
    isPro: viewMode === 'pro',
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewMode() {
  return useContext(Ctx);
}
