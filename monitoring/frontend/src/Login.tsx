import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { auth, type Me } from './api.js';

export function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await auth.login(username, password));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <form onSubmit={submit} className="card w-96 p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><Gauge size={22} /></div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Monitoring efektivity práce</h1>
            <p className="text-xs muted-2">Přihlášení do administrace</p>
          </div>
        </div>
        <label className="mb-3 block text-sm">
          <span className="muted">Uživatel</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="field mt-1 w-full" autoFocus />
        </label>
        <label className="mb-4 block text-sm">
          <span className="muted">Heslo</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1 w-full" />
        </label>
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-2 disabled:opacity-50">
          {busy ? 'Přihlašuji…' : 'Přihlásit'}
        </button>
      </form>
    </div>
  );
}
