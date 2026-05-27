import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api } from './api.js';
import { useT } from './i18n/index.js';

/**
 * Změna hesla přihlášeného admina. Žádný "zapomenuté heslo" flow –
 * je to interní nástroj, reset jde přes manuální zásah do DB.
 */
export function PasswordChangePanel() {
  const { t } = useT();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setMsg(null);
    if (newPassword !== confirm) {
      setError(t('password.mismatch'));
      return;
    }
    if (newPassword.length < 10) {
      setError(t('password.tooShort'));
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setMsg(t('password.success'));
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (e) {
      const m = String(e);
      if (m.includes('wrong_old_password')) setError(t('password.wrongOld'));
      else if (m.includes('same_password')) setError(t('password.samePassword'));
      else if (m.includes('invalid_payload')) setError(t('password.tooShort'));
      else setError(t('password.genericFailed') + m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <KeyRound size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t('password.title')}</h3>
          <p className="mt-0.5 text-xs muted-2">{t('password.subtitle')}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs muted">{t('password.oldPassword')}</span>
          <input type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="field w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs muted">{t('password.newPassword')}</span>
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs muted">{t('password.confirmPassword')}</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field w-full" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={busy || !oldPassword || !newPassword} className="btn-primary">
          <Save size={14} /> {t('password.submit')}
        </button>
        {error && <span className="rounded-md bg-red-50 px-2.5 py-1 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</span>}
        {msg && <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{msg}</span>}
      </div>
    </section>
  );
}
