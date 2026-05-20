import { useEffect, useMemo, useState } from 'react';
import { api, auth, type Me, type User } from './api.js';
import { ScoreView } from './ScoreView.js';
import { CalendarView } from './CalendarView.js';
import { Scoreboard } from './Scoreboard.js';
import { SummaryView } from './SummaryView.js';
import { AdminView } from './AdminView.js';
import { Login } from './Login.js';
import { isoDate, startOfLocalDay } from './util.js';

type Tab = 'overview' | 'calendar' | 'scoreboard' | 'summary' | 'admin';
type PeriodMode = 'day' | 'week' | 'month' | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Přehled' },
  { id: 'calendar', label: 'Kalendář' },
  { id: 'scoreboard', label: 'Žebříček' },
  { id: 'summary', label: 'Firemní přehled' },
  { id: 'admin', label: 'Správa' },
];

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [day, setDay] = useState<Date>(() => startOfLocalDay(new Date()));
  const [mode, setMode] = useState<PeriodMode>('week');
  const [customFrom, setCustomFrom] = useState<string>(isoDate(new Date()));
  const [customTo, setCustomTo] = useState<string>(isoDate(new Date()));
  const [department, setDepartment] = useState<string>('');

  useEffect(() => {
    if (auth.isLoggedIn()) {
      auth.me().then(setMe).catch(() => auth.logout()).finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    api.users().then((u) => {
      setUsers(u);
      if (u.length) setUserId(u[0].id);
    });
  }, [me]);

  const departments = useMemo(
    () => Array.from(new Set(users.map((u) => u.department).filter(Boolean))) as string[],
    [users],
  );
  const selectedUser = users.find((u) => u.id === userId);

  const { from, to } = useMemo(() => {
    const todayStart = startOfLocalDay(new Date());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (mode === 'day') {
      const f = startOfLocalDay(day);
      const t = new Date(f);
      t.setDate(t.getDate() + 1);
      return { from: f.toISOString(), to: t.toISOString() };
    }
    if (mode === 'custom') {
      const f = startOfLocalDay(new Date(customFrom));
      const t = startOfLocalDay(new Date(customTo));
      t.setDate(t.getDate() + 1);
      return { from: f.toISOString(), to: t.toISOString() };
    }
    const back = mode === 'week' ? 6 : 29;
    const f = new Date(todayStart);
    f.setDate(f.getDate() - back);
    return { from: f.toISOString(), to: tomorrow.toISOString() };
  }, [mode, day, customFrom, customTo]);

  function shiftDay(delta: number) {
    setDay((d) => {
      const x = new Date(d);
      x.setDate(x.getDate() + delta);
      return x;
    });
  }

  if (!authChecked) return <div className="p-6 text-gray-400">Načítám…</div>;
  if (!me) return <Login onLogin={setMe} />;

  const showPeriod = tab === 'overview' || tab === 'scoreboard' || tab === 'summary';
  const showUser = tab === 'overview' || tab === 'calendar';
  const showDept = tab === 'scoreboard' || tab === 'summary';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Monitoring efektivity práce na firemním PC</h1>
            <p className="text-xs text-gray-500">Pouze agregovaná data dle §316 ZP</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{me.username} · {me.role}</span>
            <button
              onClick={() => { auth.logout(); setMe(null); }}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Odhlásit
            </button>
          </div>
          <nav className="flex w-full gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 rounded px-3 py-1.5 ${tab === t.id ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Filtry */}
        {tab !== 'admin' && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {showUser && (
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName} {u.department ? `· ${u.department}` : ''}</option>
                ))}
              </select>
            )}

            {tab === 'calendar' && (
              <div className="flex items-center gap-1">
                <button onClick={() => shiftDay(-1)} className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100">‹</button>
                <span className="min-w-28 text-center font-mono text-sm">{isoDate(day)}</span>
                <button onClick={() => shiftDay(1)} className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100">›</button>
              </div>
            )}

            {showPeriod && (
              <>
                <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
                  {(['day', 'week', 'month', 'custom'] as PeriodMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`rounded px-3 py-1 ${mode === m ? 'bg-white shadow-sm' : 'text-gray-600'}`}
                    >
                      {m === 'day' ? 'Den' : m === 'week' ? 'Týden' : m === 'month' ? 'Měsíc' : 'Vlastní'}
                    </button>
                  ))}
                </div>
                {mode === 'day' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => shiftDay(-1)} className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100">‹</button>
                    <span className="min-w-28 text-center font-mono text-sm">{isoDate(day)}</span>
                    <button onClick={() => shiftDay(1)} className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100">›</button>
                  </div>
                )}
                {mode === 'custom' && (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded border border-gray-300 px-2 py-1" />
                    <span className="text-gray-400">–</span>
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded border border-gray-300 px-2 py-1" />
                  </div>
                )}
              </>
            )}

            {showDept && (
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
                <option value="">Všechna oddělení</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Obsah */}
        {tab === 'overview' && selectedUser && <ScoreView user={selectedUser} from={from} to={to} />}
        {tab === 'calendar' && selectedUser && <CalendarView user={selectedUser} day={day} />}
        {tab === 'scoreboard' && <Scoreboard from={from} to={to} department={department || undefined} />}
        {tab === 'summary' && <SummaryView from={from} to={to} department={department || undefined} />}
        {tab === 'admin' && <AdminView role={me.role} />}
      </main>
    </div>
  );
}
