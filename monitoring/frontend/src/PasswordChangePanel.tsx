import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { api } from './api.js';

/**
 * Změna hesla přihlášeného admina. Žádný "zapomenuté heslo" flow –
 * je to interní nástroj, reset jde přes manuální zásah do DB.
 */
export function PasswordChangePanel() {
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
      setError('Nové heslo a potvrzení nesedí.');
      return;
    }
    if (newPassword.length < 10) {
      setError('Nové heslo musí mít aspoň 10 znaků.');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setMsg('Heslo změněno. Ostatní přihlášení jsou odhlášeni.');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (e) {
      const msg = String(e);
      if (msg.includes('wrong_old_password')) setError('Staré heslo nesedí.');
      else if (msg.includes('same_password')) setError('Nové heslo nesmí být stejné jako staré.');
      else if (msg.includes('invalid_payload')) setError('Nové heslo musí mít aspoň 10 znaků.');
      else setError('Změna selhala: ' + msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <KeyRound size={16} className="text-emerald-600" /> Změna mého hesla
      </h3>
      <p className="mb-3 text-xs muted-2">
        Po změně se odhlásí všechna ostatní přihlášení tvého účtu (anti-takeover).
        Současné okno zůstane přihlášené.
      </p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs muted">Staré heslo</span>
          <input type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="field w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs muted">Nové heslo (min. 10 znaků)</span>
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs muted">Potvrzení nového hesla</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field w-full" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={submit} disabled={busy || !oldPassword || !newPassword} className="btn-primary">
          <Save size={14} /> Změnit heslo
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  );
}
