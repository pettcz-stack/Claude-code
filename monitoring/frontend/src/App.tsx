import { useEffect, useMemo, useState } from 'react';
import { api, auth, type Me, type User } from './api.js';
import { CalendarView } from './CalendarView.js';
import { SummaryView } from './SummaryView.js';
import { AdminView } from './AdminView.js';
import { Login } from './Login.js';
import { isoDate, startOfUtcDay } from './util.js';

type Tab = 'calendar' | 'summary' | 'admin';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('calendar');
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [day, setDay] = useState<Date>(() => startOfUtcDay(new Date()));
  const [rangeDays, setRangeDays] = useState(7);
  const [department, setDepartment] = useState<string>('');

  useEffect(() => {
    if (auth.isLoggedIn()) {
      auth
        .me()
        .then(setMe)
        .catch(() => auth.logout())
        .finally(() => setAuthChecked(true));
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

  const to = useMemo(() => {
    const t = startOfUtcDay(new Date());
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString();
  }, []);
  const from = useMemo(() => {
    const f = startOfUtcDay(new Date());
    f.setUTCDate(f.getUTCDate() - rangeDays + 1);
    return f.toISOString();
  }, [rangeDays]);

  function shiftDay(delta: number) {
    setDay((d) => {
      const x = new Date(d);
      x.setUTCDate(x.getUTCDate() + delta);
      return x;
    });
  }

  if (!authChecked) return <div className="p-6 text-gray-400">Načítám…</div>;
  if (!me) return <Login onLogin={setMe} />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold">WorkView</h1>
            <p className="text-xs text-gray-500">Přehled využití firemních zařízení (§316 ZP – pouze agregovaná data)</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
              <button
                onClick={() => setTab('calendar')}
                className={`rounded px-3 py-1.5 ${tab === 'calendar' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                Kalendář (hodinově)
              </button>
              <button
                onClick={() => setTab('summary')}
                className={`rounded px-3 py-1.5 ${tab === 'summary' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                Firemní přehled
              </button>
              <button
                onClick={() => setTab('admin')}
                className={`rounded px-3 py-1.5 ${tab === 'admin' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                Správa
              </button>
            </nav>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{me.username} · {me.role}</span>
              <button
                onClick={() => {
                  auth.logout();
                  setMe(null);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
              >
                Odhlásit
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {tab === 'admin' ? (
          <AdminView role={me.role} />
        ) : tab === 'calendar' ? (
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} {u.department ? `· ${u.department}` : ''}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button onClick={() => shiftDay(-1)} className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100">‹</button>
                <span className="min-w-28 text-center font-mono text-sm">{isoDate(day)}</span>
                <button onClick={() => shiftDay(1)} className="rounded border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-100">›</button>
              </div>
            </div>
            {selectedUser ? (
              <CalendarView user={selectedUser} day={day} />
            ) : (
              <p className="text-gray-400">Žádní uživatelé.</p>
            )}
          </section>
        ) : (
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value={7}>Posledních 7 dní</option>
                <option value={14}>Posledních 14 dní</option>
                <option value={30}>Posledních 30 dní</option>
              </select>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Všechna oddělení</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <SummaryView from={from} to={to} department={department || undefined} />
          </section>
        )}
      </main>
    </div>
  );
}
