import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { auth, type Me } from './api.js';
import { useT } from './i18n/index.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';

export function Login({ onLogin }: { onLogin: (me: Me) => void }) {
  const { t } = useT();
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
    } catch {
      setError(t('login.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 p-4 dark:from-slate-950 dark:to-slate-900">
      {/* Jazykový přepínač vpravo nahoře */}
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <form onSubmit={submit} className="card w-full max-w-md p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Gauge size={24} />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">FOCUS</h1>
            <p className="text-xs muted-2">{t('login.subtitle')}</p>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-medium">{t('login.title')}</h2>

        <label className="mb-3 block text-sm">
          <span className="muted">{t('login.username')}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="field mt-1 w-full"
            autoFocus
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="muted">{t('login.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="field mt-1 w-full"
          />
        </label>
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={busy || !username || !password} className="btn-primary w-full justify-center py-2 disabled:opacity-50">
          {busy ? t('common.loading') : t('login.submit')}
        </button>
      </form>
    </div>
  );
}
