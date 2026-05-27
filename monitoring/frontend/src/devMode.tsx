import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Developer mode — když je zapnutý, dashboard zobrazuje u každé metriky
 * ⓘ ikonku s tooltipem vysvětlujícím metodiku výpočtu. Slouží:
 *  - auditorům / DPO pro pochopení co se měří
 *  - manažerům pro transparentní vysvětlení čísel
 *  - vývojářům pro debug, jak se která hodnota odvozuje
 *
 * Stav v localStorage (per browser). Toggle v UserMenu (jen pro ADMIN).
 */

type DevModeCtx = {
  devMode: boolean;
  setDevMode: (v: boolean) => void;
};

const Ctx = createContext<DevModeCtx>({ devMode: false, setDevMode: () => undefined });

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevModeState] = useState<boolean>(() => {
    return localStorage.getItem('focus_dev_mode') === '1';
  });
  useEffect(() => {
    localStorage.setItem('focus_dev_mode', devMode ? '1' : '0');
  }, [devMode]);
  return (
    <Ctx.Provider value={{ devMode, setDevMode: setDevModeState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDevMode() {
  return useContext(Ctx);
}
