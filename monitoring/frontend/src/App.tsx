import { useEffect, useMemo, useState } from 'react';
import {
  Gauge, LayoutDashboard, User as UserIcon, Trophy, TrendingUp, AppWindow, CalendarDays, Table2, Shield,
  ShieldAlert, SlidersHorizontal, House, BadgeCheck, KeyRound, Sun, Moon, LogOut, ChevronLeft, ChevronRight,
  Menu, Search,
} from 'lucide-react';
import { api, auth, type Me, type User } from './api.js';
import { CommandPalette, type Command } from './CommandPalette.js';
import { OverviewView } from './OverviewView.js';
import { HomeOfficeView } from './HomeOfficeView.js';
import { SelfReportView } from './SelfReportView.js';
import { DetailView } from './DetailView.js';
import { CalendarView } from './CalendarView.js';
import { Scoreboard } from './Scoreboard.js';
import { SummaryView } from './SummaryView.js';
import { AdminView } from './AdminView.js';
import { TrendChart } from './TrendChart.js';
import { TopActivities } from './TopActivities.js';
import { CategoryAdmin } from './CategoryAdmin.js';
import { AlertsView } from './AlertsView.js';
import { SoftwareView } from './SoftwareView.js';
import { SettingsView } from './SettingsView.js';
import { Login } from './Login.js';
import { useTheme } from './theme.js';
import { isoDate, startOfLocalDay } from './util.js';

type Tab = 'overview' | 'homeoffice' | 'detail' | 'selfreport' | 'scoreboard' | 'alerts' | 'trends' | 'apps' | 'software' | 'calendar' | 'summary' | 'admin' | 'settings';
type PeriodMode = 'day' | 'week' | 'month' | 'custom';

type NavItem = { id: Tab; label: string; Icon: typeof UserIcon };
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Přehled',
    items: [
      { id: 'overview', label: 'Přehled firmy', Icon: LayoutDashboard },
      { id: 'scoreboard', label: 'Žebříček', Icon: Trophy },
      { id: 'trends', label: 'Trendy', Icon: TrendingUp },
      { id: 'alerts', label: 'Upozornění', Icon: ShieldAlert },
    ],
  },
  {
    title: 'Zaměstnanci',
    items: [
      { id: 'detail', label: 'Detail uživatele', Icon: UserIcon },
      { id: 'selfreport', label: 'Report zaměstnance', Icon: BadgeCheck },
      { id: 'homeoffice', label: 'Home Office', Icon: House },
      { id: 'calendar', label: 'Kalendář', Icon: CalendarDays },
    ],
  },
  {
    title: 'Náklady & software',
    items: [
      { id: 'software', label: 'Software & náklady', Icon: KeyRound },
      { id: 'apps', label: 'Aplikace & weby', Icon: AppWindow },
      { id: 'summary', label: 'Firemní přehled', Icon: Table2 },
    ],
  },
  {
    title: 'Systém',
    items: [
      { id: 'admin', label: 'Správa', Icon: Shield },
      { id: 'settings', label: 'Nastavení', Icon: SlidersHorizontal },
    ],
  },
];
const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [day, setDay] = useState<Date>(() => startOfLocalDay(new Date()));
  const [mode, setMode] = useState<PeriodMode>('month');
  const [customFrom, setCustomFrom] = useState<string>(isoDate(new Date()));
  const [customTo, setCustomTo] = useState<string>(isoDate(new Date()));
  const [department, setDepartment] = useState<string>('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (auth.isLoggedIn()) auth.me().then(setMe).catch(() => auth.logout()).finally(() => setAuthChecked(true));
    else setAuthChecked(true);
  }, []);

  // Command palette: Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!me) return;
    api.users().then((u) => { setUsers(u); if (u.length) setUserId(u[0].id); });
  }, [me]);

  const departments = useMemo(() => Array.from(new Set(users.map((u) => u.department).filter(Boolean))) as string[], [users]);
  const selectedUser = users.find((u) => u.id === userId);
  const dark = theme === 'dark';

  const commands: Command[] = useMemo(() => {
    const pages: Command[] = NAV.map((n) => ({ id: 'p:' + n.id, label: n.label, hint: 'stránka', onSelect: () => setTab(n.id) }));
    const people: Command[] = users.map((u) => ({
      id: 'u:' + u.id,
      label: u.displayName ?? u.sid,
      hint: u.department ?? 'zaměstnanec',
      onSelect: () => { setUserId(u.id); setTab('detail'); },
    }));
    return [...pages, ...people];
  }, [users]);

  const { from, to } = useMemo(() => {
    const todayStart = startOfLocalDay(new Date());
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
    if (mode === 'day') { const f = startOfLocalDay(day); const t = new Date(f); t.setDate(t.getDate() + 1); return { from: f.toISOString(), to: t.toISOString() }; }
    if (mode === 'custom') { const f = startOfLocalDay(new Date(customFrom)); const t = startOfLocalDay(new Date(customTo)); t.setDate(t.getDate() + 1); return { from: f.toISOString(), to: t.toISOString() }; }
    const back = mode === 'week' ? 6 : 29;
    const f = new Date(todayStart); f.setDate(f.getDate() - back);
    return { from: f.toISOString(), to: tomorrow.toISOString() };
  }, [mode, day, customFrom, customTo]);

  function shiftDay(delta: number) { setDay((d) => { const x = new Date(d); x.setDate(x.getDate() + delta); return x; }); }

  if (!authChecked) return <div className="p-6 muted-2">Načítám…</div>;
  if (!me) return <Login onLogin={setMe} />;

  const needsUser = tab === 'detail' || tab === 'calendar' || tab === 'selfreport';
  const needsPeriod = tab === 'overview' || tab === 'homeoffice' || tab === 'detail' || tab === 'selfreport' || tab === 'scoreboard' || tab === 'summary' || tab === 'apps' || tab === 'software' || tab === 'trends' || tab === 'alerts';
  const needsDept = tab === 'overview' || tab === 'homeoffice' || tab === 'scoreboard' || tab === 'summary' || tab === 'apps' || tab === 'software' || tab === 'trends' || tab === 'alerts';
  const title = NAV.find((n) => n.id === tab)?.label ?? '';

  // čitelný rozsah období do hlavičky (to je exkluzivní konec → −1 den)
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const rangeLabel = tab === 'calendar'
    ? isoDate(day)
    : `${fmt(from)} – ${fmt(new Date(new Date(to).getTime() - 86400000).toISOString())}`;

  return (
    <div className="flex min-h-screen">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
      {/* Overlay pro mobilní sidebar */}
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform dark:border-slate-700/70 dark:bg-slate-800/40 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white"><Gauge size={20} /></div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Monitoring efektivity</div>
            <div className="text-[11px] muted-2">práce na firemním PC</div>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-1">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-semibold uppercase tracking-wider muted-2">{section.title}</div>
              {section.items.map(({ id, label, Icon }) => {
                const activeItem = tab === id;
                return (
                  <button key={id} onClick={() => setTab(id)} aria-current={activeItem ? 'page' : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      activeItem ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'muted hover:bg-gray-100 dark:hover:bg-slate-700/50'}`}>
                    {activeItem && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-emerald-500" />}
                    <Icon size={18} /> {label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t border-gray-200 p-3 dark:border-slate-700/70">
          <button onClick={toggleTheme} className="btn-ghost w-full justify-start">
            {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Světlý režim' : 'Tmavý režim'}
          </button>
          <div className="flex items-center justify-between px-1">
            <div className="text-xs"><div className="font-medium">{me.username}</div><div className="muted-2">{me.role}</div></div>
            <button onClick={() => { auth.logout(); setMe(null); }} className="muted-2 hover:text-red-500" title="Odhlásit"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      {/* Obsah */}
      <div className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50/80 px-4 py-3 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost px-2 lg:hidden" title="Menu"><Menu size={18} /></button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{title}</h1>
            {(needsPeriod || tab === 'calendar') && <div className="text-xs muted-2">{rangeLabel}</div>}
          </div>
          <button onClick={() => setCmdOpen(true)} className="btn-ghost ml-2 hidden items-center gap-2 sm:flex" title="Hledat (Ctrl+K)">
            <Search size={15} /> <span className="muted-2">Hledat</span>
            <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] muted-2 dark:border-slate-600">⌘K</span>
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {needsUser && (
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className="field">
                {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} {u.department ? `· ${u.department}` : ''}</option>)}
              </select>
            )}
            {tab === 'calendar' && (
              <div className="flex items-center gap-1">
                <button onClick={() => shiftDay(-1)} className="btn-ghost px-2"><ChevronLeft size={16} /></button>
                <span className="min-w-28 text-center font-mono text-sm">{isoDate(day)}</span>
                <button onClick={() => shiftDay(1)} className="btn-ghost px-2"><ChevronRight size={16} /></button>
              </div>
            )}
            {needsPeriod && (
              <>
                <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-slate-800">
                  {(['day', 'week', 'month', 'custom'] as PeriodMode[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`rounded px-3 py-1 ${mode === m ? 'bg-white shadow-sm dark:bg-slate-700' : 'muted'}`}>
                      {m === 'day' ? 'Den' : m === 'week' ? 'Týden' : m === 'month' ? 'Měsíc' : 'Vlastní'}
                    </button>
                  ))}
                </div>
                {mode === 'day' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => shiftDay(-1)} className="btn-ghost px-2"><ChevronLeft size={16} /></button>
                    <span className="min-w-28 text-center font-mono text-sm">{isoDate(day)}</span>
                    <button onClick={() => shiftDay(1)} className="btn-ghost px-2"><ChevronRight size={16} /></button>
                  </div>
                )}
                {mode === 'custom' && (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="field" />
                    <span className="muted-2">–</span>
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="field" />
                  </div>
                )}
              </>
            )}
            {needsDept && (
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="field">
                <option value="">Všechna oddělení</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        </header>

        <main key={tab} className="fade-in p-6">
          {tab === 'overview' && <OverviewView from={from} to={to} department={department || undefined} dark={dark} onOpenUser={(id) => { setUserId(id); setTab('detail'); }} />}
          {tab === 'homeoffice' && <HomeOfficeView from={from} to={to} department={department || undefined} onOpenUser={(id) => { setUserId(id); setTab('detail'); }} />}
          {tab === 'selfreport' && selectedUser && <SelfReportView user={selectedUser} from={from} to={to} />}
          {tab === 'detail' && selectedUser && <DetailView user={selectedUser} from={from} to={to} dark={dark} />}
          {tab === 'scoreboard' && <Scoreboard from={from} to={to} department={department || undefined} />}
          {tab === 'alerts' && <AlertsView from={from} to={to} department={department || undefined} onOpenUser={(id) => { setUserId(id); setTab('detail'); }} />}
          {tab === 'trends' && (
            <div className="space-y-4">
              <TrendChart from={from} to={to} department={department || undefined} dark={dark} />
              <TopActivities from={from} to={to} department={department || undefined} />
            </div>
          )}
          {tab === 'apps' && (
            <div className="space-y-4">
              <TopActivities from={from} to={to} department={department || undefined} />
              <CategoryAdmin canEdit={me.role === 'ADMIN'} from={from} to={to} />
            </div>
          )}
          {tab === 'software' && <SoftwareView from={from} to={to} department={department || undefined} canEdit={me.role === 'ADMIN'} />}
          {tab === 'calendar' && selectedUser && <CalendarView user={selectedUser} day={day} />}
          {tab === 'summary' && <SummaryView from={from} to={to} department={department || undefined} />}
          {tab === 'admin' && <AdminView role={me.role} />}
          {tab === 'settings' && <SettingsView canEdit={me.role === 'ADMIN'} />}
        </main>
      </div>
    </div>
  );
}
