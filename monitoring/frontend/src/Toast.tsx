import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: Kind; text: string };

const ToastCtx = createContext<(text: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const ICON = {
  success: <CheckCircle2 size={18} className="text-emerald-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  info: <Info size={18} className="text-sky-500" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="fade-in pointer-events-auto flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {ICON[t.kind]}
            <span className="max-w-xs">{t.text}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="muted-2 hover:text-gray-600"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
