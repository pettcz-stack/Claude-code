import { useEffect, useState } from 'react';
import { Laptop2, LogOut } from 'lucide-react';
import { api } from './api.js';

type Sess = { id: string; createdAt: string; expiresAt: string; lastUsedAt: string; isCurrent: boolean };

/**
 * Aktivní sessions přihlášeného admina. Funkce "kde jsem všude přihlášený"
 * – revoke ostatních při podezření na ztracený notebook nebo nechtěném sdílení.
 */
export function SessionsPanel() {
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const r = await api.mySessions();
      setSessions(r.sessions);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => { reload(); }, []);

  async function revoke(id: string) {
    if (!window.confirm('Opravdu odhlásit toto přihlášení?')) return;
    try {
      await api.revokeSession(id);
      reload();
    } catch (e) { setError(String(e)); }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Laptop2 size={16} className="text-emerald-600" /> Moje aktivní přihlášení
      </h3>
      <p className="mb-3 text-xs muted-2">
        Seznam zařízení / prohlížečů, ze kterých jsi přihlášený. Ostatní můžeš odhlásit,
        např. když jsi zapomněl odhlášení na cizím PC.
      </p>
      {error && <p className="text-sm text-red-500">Chyba: {error}</p>}
      {sessions && sessions.length === 0 && <p className="text-sm muted-2">Žádné aktivní přihlášení.</p>}
      {sessions && sessions.length > 0 && (
        <table className="w-full">
          <thead><tr><th className="th">Stav</th><th className="th">Přihlášeno</th><th className="th">Naposled použito</th><th className="th">Vyprší</th><th className="th"></th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="divide-row">
                <td className="td">{s.isCurrent ? <span className="chip-work">tato</span> : <span className="chip-neutral">jiná</span>}</td>
                <td className="td text-xs tabular-nums">{new Date(s.createdAt).toLocaleString('cs-CZ')}</td>
                <td className="td text-xs tabular-nums">{new Date(s.lastUsedAt).toLocaleString('cs-CZ')}</td>
                <td className="td text-xs tabular-nums muted-2">{new Date(s.expiresAt).toLocaleString('cs-CZ')}</td>
                <td className="td text-right">
                  {!s.isCurrent && (
                    <button onClick={() => revoke(s.id)} className="btn-ghost text-xs text-red-600">
                      <LogOut size={13} /> Odhlásit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
