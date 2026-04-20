import { useEffect, useState } from "react";
import { api, type Account } from "../api";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => setAccounts(await api.listAccounts());
  useEffect(() => {
    load();
  }, []);

  const daysUntil = (iso: string | null): number | null => {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - Date.now();
    return Math.round(diff / (24 * 3600 * 1000));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Připojené účty</h2>
          <p className="text-sm text-slate-500">
            Pro přidání nové FB stránky nebo Instagram Business účtu se přihlaste přes Meta OAuth.
          </p>
        </div>
        <a className="btn-primary" href="/auth/start">
          Připojit přes Meta
        </a>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left">Platforma</th>
              <th className="p-2 text-left">Stránka</th>
              <th className="p-2 text-left">Page ID</th>
              <th className="p-2 text-left">Token expiruje</th>
              <th className="p-2 text-left">Aktivní</th>
              <th className="p-2 text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const days = daysUntil(a.tokenExpiresAt);
              return (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <span className="pill bg-slate-100 text-slate-700 ring-slate-300">{a.platform}</span>
                  </td>
                  <td className="p-2">{a.pageName}</td>
                  <td className="p-2 text-xs text-slate-500">{a.pageId}</td>
                  <td className="p-2">
                    {days === null ? (
                      "—"
                    ) : days < 7 ? (
                      <span className="text-red-700">za {days} dní</span>
                    ) : (
                      <span>za {days} dní</span>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={a.active}
                      onChange={async () => {
                        await api.patchAccount(a.id, { active: !a.active });
                        await load();
                      }}
                    />
                  </td>
                  <td className="p-2 text-right space-x-1">
                    <button
                      className="btn-muted"
                      disabled={busy === a.id}
                      onClick={async () => {
                        setBusy(a.id);
                        try {
                          const r = await api.triggerFetch(a.id);
                          alert(`Načteno: ${r.postsSeen} příspěvků, ${r.newComments} nových komentářů`);
                        } catch (e) {
                          alert(String(e));
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === a.id ? "Načítám…" : "Načíst nyní"}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        if (!confirm(`Odpojit ${a.pageName}?`)) return;
                        await api.deleteAccount(a.id);
                        await load();
                      }}
                    >
                      Odpojit
                    </button>
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Zatím nejsou připojeny žádné účty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
