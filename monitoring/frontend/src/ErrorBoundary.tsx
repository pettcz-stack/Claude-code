import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

/**
 * Globální ErrorBoundary pro celou SPA. Bez něj by jediná runtime výjimka
 * v libovolné komponentě smazala celý dashboard – uživatel vidí bílou
 * obrazovku a netuší, co se stalo.
 *
 * S boundárkou zobrazíme přátelské hlášení, tlačítko na refresh a
 * v dev konzoli vyhodíme console.error pro vývojáře. Pro produkční
 * telemetrii (Sentry apod.) sem přidat hook.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('FOCUS UI error boundary:', err, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-slate-900">
        <div className="card max-w-md p-6 text-center">
          <div className="mb-2 text-3xl">😕</div>
          <div className="text-base font-semibold">FOCUS – něco se pokazilo</div>
          <div className="mt-2 text-xs muted-2 break-words">{this.state.message}</div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            Obnovit stránku
          </button>
          <div className="mt-3 text-[10px] muted-2">
            Pokud chyba přetrvává, kontaktuj IT správce (popis chyby zkopíruj z textu výše).
          </div>
        </div>
      </div>
    );
  }
}
