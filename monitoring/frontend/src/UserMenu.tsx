import { useEffect, useRef, useState } from 'react';
import { LogOut, ChevronDown, ShieldCheck, Code2, Sparkles, Download, Apple, Gauge, Layers } from 'lucide-react';
import { useT } from './i18n/index.js';
import { useDevMode } from './devMode.js';
import { useViewMode } from './viewMode.js';
import { CURRENT_VERSION } from './releases.js';
import { WhatsNewPanel } from './WhatsNew.js';

// URL šablona pro stažení agenta. `agent-latest` je rolling tag, který CI bumpne
// při každém úspěšném buildu nové verze agenta.
const AGENT_DOWNLOAD = {
  windows: 'https://github.com/pettcz-stack/claude-code/releases/download/agent-latest/FocusAgent.msi',
  macos:   'https://github.com/pettcz-stack/claude-code/releases/download/agent-latest/FocusAgent.pkg',
  // Pro non-PKG fallback (manuální instalace ze zdroje)
  macosScript: 'https://github.com/pettcz-stack/claude-code/releases/download/agent-latest/install-mac.sh',
};

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
  const { devMode, setDevMode } = useDevMode();
  const { viewMode, setViewMode } = useViewMode();
  const [open, setOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
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
        <div className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-medium">{username}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <ShieldCheck size={11} className="opacity-60" />
              <span className={`inline-block rounded px-1.5 py-0 font-medium uppercase ${ROLE_COLOR[role] ?? ROLE_COLOR.VIEWER}`}>{role}</span>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); setWhatsNewOpen(true); }}
            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-500" />
              <span>{t('userMenu.whatsNew')}</span>
            </span>
            <span className="text-[10px] font-mono muted-2">v{CURRENT_VERSION}</span>
          </button>
          {/* View mode toggle (Basic vs Pro) – dostupné pro všechny role */}
          <div className="border-t border-gray-100 px-4 py-2 dark:border-slate-800">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide muted-2">
              {t('userMenu.viewMode')}
            </div>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-xs dark:bg-slate-800">
              <button
                onClick={() => setViewMode('basic')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                  viewMode === 'basic'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'muted hover:text-gray-700 dark:hover:text-slate-200'
                }`}
                title={t('userMenu.viewModeBasicTooltip')}
              >
                <Gauge size={12} />
                <span>{t('userMenu.viewModeBasic')}</span>
              </button>
              <button
                onClick={() => setViewMode('pro')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                  viewMode === 'pro'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'muted hover:text-gray-700 dark:hover:text-slate-200'
                }`}
                title={t('userMenu.viewModeProTooltip')}
              >
                <Layers size={12} />
                <span>{t('userMenu.viewModePro')}</span>
              </button>
            </div>
          </div>
          {role === 'ADMIN' && (
            <button
              onClick={() => setDevMode(!devMode)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
              title={t('userMenu.devModeTooltip')}
            >
              <span className="flex items-center gap-2">
                <Code2 size={14} className="text-blue-500" />
                <span>{t('userMenu.devMode')}</span>
              </span>
              <span className={`inline-block h-4 w-7 rounded-full transition-colors ${devMode ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'} relative`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${devMode ? 'left-3.5' : 'left-0.5'}`} />
              </span>
            </button>
          )}
          {role === 'ADMIN' && devMode && (
            <div className="border-t border-gray-100 px-4 py-2 dark:border-slate-800">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide muted-2">
                {t('userMenu.downloadAgent')}
              </div>
              <div className="flex gap-1.5">
                <a
                  href={AGENT_DOWNLOAD.windows}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-xs hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  download
                  onClick={() => setOpen(false)}
                  title={t('userMenu.downloadWindowsTooltip')}
                >
                  <Download size={12} className="text-sky-500" />
                  <span>Windows</span>
                </a>
                <a
                  href={AGENT_DOWNLOAD.macos}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-xs hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  download
                  onClick={() => setOpen(false)}
                  title={t('userMenu.downloadMacosTooltip')}
                >
                  <Apple size={12} className="text-zinc-500" />
                  <span>macOS</span>
                </a>
              </div>
              <a
                href={AGENT_DOWNLOAD.macosScript}
                className="mt-1.5 block text-[10px] muted-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {t('userMenu.downloadMacosScript')}
              </a>
            </div>
          )}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-left text-sm hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            <LogOut size={14} className="text-red-500" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      )}
      {whatsNewOpen && <WhatsNewPanel onClose={() => setWhatsNewOpen(false)} />}
    </div>
  );
}
