import { useEffect, useRef, useState } from 'react';
import { LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import { useT } from './i18n/index.js';

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  MANAGER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  IT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  VIEWER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

/**
 * Avatar + dropdown s jménem, rolí a tlačítkem Odhlásit.
 * Standardní pozice (vpravo nahoře v hlavičce) – uživatel ji ze všech ostatních
 * dashboardů zná a očekává tam.
 */
export function UserMenu({ username, role, onLogout }: { username: string; role: string; onLogout: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-slate-800"
        aria-label={username}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium leading-tight">{username}</span>
          <span className={`mt-0.5 inline-block rounded px-1.5 py-0 text-[9px] font-medium uppercase ${ROLE_COLOR[role] ?? ROLE_COLOR.VIEWER}`}>{role}</span>
        </span>
        <ChevronDown size={14} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-medium">{username}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <ShieldCheck size={11} className="opacity-60" />
              <span className={`inline-block rounded px-1.5 py-0 font-medium uppercase ${ROLE_COLOR[role] ?? ROLE_COLOR.VIEWER}`}>{role}</span>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <LogOut size={14} className="text-red-500" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
