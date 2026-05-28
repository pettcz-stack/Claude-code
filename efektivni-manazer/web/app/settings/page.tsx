"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { api, ImapSettings, Profile } from "@/lib/api";

export default function SettingsPage() {
  const [imap, setImap] = useState<ImapSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [imapPwd, setImapPwd] = useState("");
  const [aliasesInput, setAliasesInput] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [i, p] = await Promise.all([
          api<ImapSettings>("/settings/imap"),
          api<Profile>("/settings/profile"),
        ]);
        setImap(i);
        setProfile(p);
        setAliasesInput((p.my_aliases || []).join(", "));
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, []);

  async function saveImap(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg("");
    setErr("");
    try {
      if (!imap) return;
      const body: any = { ...imap };
      if (imapPwd) body.password = imapPwd;
      else body.password = null;
      const r = await api<ImapSettings>("/settings/imap", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setImap(r);
      setImapPwd("");
      setSavedMsg("Uloženo");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg("");
    setErr("");
    try {
      if (!profile) return;
      const aliases = aliasesInput.split(",").map((s) => s.trim()).filter(Boolean);
      const r = await api<Profile>("/settings/profile", {
        method: "PUT",
        body: JSON.stringify({ ...profile, my_aliases: aliases }),
      });
      setProfile(r);
      setSavedMsg("Uloženo");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (!imap || !profile) return <><Nav /><main className="p-8 text-muted">Načítám…</main></>;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        {savedMsg && <p className="text-brand">{savedMsg}</p>}
        {err && <p className="text-danger">{err}</p>}

        <section className="rounded border border-line bg-panel p-6">
          <h2 className="mb-1 text-lg font-semibold">Můj profil</h2>
          <p className="mb-4 text-sm text-muted">
            Aplikace potřebuje vědět, který email a aliasy jsi „Ty", aby správně
            určila směr úkolů.
          </p>
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Jméno</label>
              <input
                value={profile.my_name}
                onChange={(e) => setProfile({ ...profile, my_name: e.target.value })}
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Primární email</label>
              <input
                type="email"
                value={profile.my_email}
                onChange={(e) => setProfile({ ...profile, my_email: e.target.value })}
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                Aliasy (oddělené čárkou)
              </label>
              <input
                value={aliasesInput}
                onChange={(e) => setAliasesInput(e.target.value)}
                placeholder="me+work@…, me@firma.com"
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
            <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-bg">
              Uložit profil
            </button>
          </form>
        </section>

        <section className="rounded border border-line bg-panel p-6">
          <h2 className="mb-1 text-lg font-semibold">IMAP připojení</h2>
          <div className="mb-4 space-y-2 text-sm text-muted">
            <p>
              <strong>Doporučeno (davmail gateway uvnitř compose):</strong>{" "}
              host <code>davmail</code>, port <code>1143</code>, SSL <em>off</em>.
              Heslo zadej libovolné – davmail si autorizaci ošetří přes prohlížeč
              (postup viz README). Tahle cesta nevyžaduje IMAP povolený na O365 tenantu.
            </p>
            <p>
              <strong>Alternativa (přímý IMAP):</strong>{" "}
              <code>outlook.office365.com:993 (SSL)</code> + App Password – jen
              když admin IMAP nezavřel.
            </p>
            <p>Heslo se uloží zašifrované Fernet klíčem.</p>
          </div>
          <form onSubmit={saveImap} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Host</label>
                <input
                  value={imap.host}
                  onChange={(e) => setImap({ ...imap, host: e.target.value })}
                  placeholder="outlook.office365.com"
                  className="w-full rounded border border-line bg-bg px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Port</label>
                <input
                  type="number"
                  value={imap.port}
                  onChange={(e) => setImap({ ...imap, port: Number(e.target.value) })}
                  className="w-full rounded border border-line bg-bg px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Uživatelské jméno (email)</label>
              <input
                value={imap.username}
                onChange={(e) => setImap({ ...imap, username: e.target.value })}
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                Heslo {imap.configured && "(už uloženo – ponech prázdné pro zachování)"}
              </label>
              <input
                type="password"
                value={imapPwd}
                onChange={(e) => setImapPwd(e.target.value)}
                placeholder={imap.configured ? "••••••••" : ""}
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Inbox složka</label>
                <input
                  value={imap.inbox_folder}
                  onChange={(e) => setImap({ ...imap, inbox_folder: e.target.value })}
                  className="w-full rounded border border-line bg-bg px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Sent složka</label>
                <input
                  value={imap.sent_folder}
                  onChange={(e) => setImap({ ...imap, sent_folder: e.target.value })}
                  className="w-full rounded border border-line bg-bg px-3 py-2"
                />
              </div>
            </div>
            <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-bg">
              Uložit IMAP
            </button>
          </form>
        </section>

        <section className="rounded border border-line bg-panel p-6">
          <h2 className="mb-1 text-lg font-semibold">Demo data</h2>
          <p className="mb-4 text-sm text-muted">
            Naplní DB realistickými ukázkovými úkoly (delegované i moje, různé fáze,
            po termínu, hotové) – ať si nasimulujeme jak to vypadá, než přijde reálný
            mail z IMAPu. <strong>Pozor:</strong> nejdřív smaže všechna existující data
            (kromě profilu a IMAP nastavení).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Smazat existující úkoly a nahrát demo data?")) return;
                try {
                  const r = await api<Record<string, number>>("/settings/seed-demo", {
                    method: "POST",
                  });
                  setSavedMsg(
                    `Demo nahrané: ${r.tasks} úkolů, ${r.messages} mailů, ${r.notifications} notifikací.`
                  );
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
              className="rounded bg-brand px-4 py-2 text-sm font-medium text-bg"
            >
              Naplnit demo data
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Opravdu smazat VŠECHNY úkoly, vlákna a notifikace?")) return;
                try {
                  await api("/settings/wipe-all", { method: "POST" });
                  setSavedMsg("Všechna data smazána.");
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
              className="rounded border border-rose-500/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
            >
              Smazat všechna data
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
