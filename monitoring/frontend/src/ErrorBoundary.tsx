import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

/**
 * Globální ErrorBoundary pro celou SPA. Bez něj by jediná runtime výjimka
 * v libovolné komponentě smazala celý dashboard – uživatel vidí bílou
 * obrazovku a netuší, co se stalo.
 *
 * Texty jsou v češtině – boundary je výjimečný kód mimo i18n strom
 * (i18n provider sám může vyhodit chybu, takže nesmí na něm záviset).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // Logujeme jen ve vývoji (DEV server) – v produkci nechceme stack trace
    // v DevTools viditelný end-userům. Boundary stejně ukáže detail v UI.
    // Vite injectuje import.meta.env, my však použijeme bezpečné `(import.meta as any)`.
    const dev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
    if (dev) {
      // eslint-disable-next-line no-console
      console.error('FOCUS UI error boundary:', err, info.componentStack);
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-slate-900">
        <div className="card max-w-md p-7 text-center">
          <div className="mb-3 text-3xl">😕</div>
          <div className="text-base font-semibold">FOCUS – něco se pokazilo / something went wrong</div>
          <div className="mt-3 break-words text-xs muted-2">{this.state.message}</div>
          <button onClick={() => window.location.reload()} className="btn-primary mt-5">
            Obnovit stránku / Reload page
          </button>
          <div className="mt-3 text-[10px] muted-2">
            Pokud chyba přetrvává, kontaktuj IT správce. / If the error persists, contact your IT admin.
          </div>
        </div>
      </div>
    );
  }
}
