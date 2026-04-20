import { useEffect, useState } from "react";
import { api } from "../api";

export default function Admin() {
  const [status, setStatus] = useState<{ activeAccounts: number; pending: number; actions24h: number } | null>(
    null
  );
  const [retention, setRetention] = useState(730);
  const [reclassifyHours, setReclassifyHours] = useState(24);
  const [log, setLog] = useState<string[]>([]);
  const [ready, setReady] = useState<Awaited<ReturnType<typeof api.adminReady>> | null>(null);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof api.getSettings>> | null>(null);
  const [keywordsText, setKeywordsText] = useState("");

  const load = async () => {
    setStatus(await api.adminStatus());
    try {
      setReady(await api.adminReady());
    } catch {
      setReady(null);
    }
    try {
      const s = await api.getSettings();
      setSettings(s);
      setKeywordsText(s.criticalKeywords.join(", "));
    } catch {
      setSettings(null);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const push = (msg: string) =>
    setLog((l) => [`[${new Date().toLocaleTimeString("cs-CZ")}] ${msg}`, ...l].slice(0, 30));

  return (
    <div className="space-y-6">
      {settings && (
        <section className={`rounded shadow-sm p-4 border-2 ${settings.replyEnabled ? "bg-amber-50 border-amber-300" : "bg-emerald-50 border-emerald-300"}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                Odpovědi na komentáře:{" "}
                <span className={settings.replyEnabled ? "text-amber-700" : "text-emerald-700"}>
                  {settings.replyEnabled ? "POVOLENÉ" : "VYPNUTÉ (kill switch)"}
                </span>
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {settings.replyEnabled
                  ? "Aplikace může publikovat odpovědi a generovat AI návrhy. Při obavách o bezpečnost vypni."
                  : "Aplikace NEmůže publikovat na tvé profily ani generovat AI návrhy. Hide/Delete/Keep stále funguje."}
              </p>
            </div>
            <button
              className={settings.replyEnabled ? "btn-danger" : "btn-primary"}
              onClick={async () => {
                const next = !settings.replyEnabled;
                if (next && !confirm("Opravdu povolit odpovědi? Aplikace pak může psát na vaše Facebook/Instagram profily.")) {
                  return;
                }
                await api.setReplyEnabled(next);
                push(`Odpovědi: ${next ? "ZAPNUTÉ" : "VYPNUTÉ"}`);
                await load();
              }}
            >
              {settings.replyEnabled ? "VYPNOUT odpovědi" : "Zapnout odpovědi"}
            </button>
          </div>
        </section>
      )}

      {settings && (
        <section className="bg-white rounded shadow-sm p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Kritická klíčová slova</h2>
            <p className="text-sm text-slate-500 mt-1">
              Komentáře obsahující libovolné z těchto slov (bez ohledu na AI kategorii) spustí
              okamžitou notifikaci. Oddělené čárkami.
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const kws = keywordsText.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
              const r = await api.setCriticalKeywords(kws);
              setKeywordsText(r.criticalKeywords.join(", "));
              push(`Kritická slova: ${r.criticalKeywords.length}`);
              await load();
            }}
          >
            <input
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="např. podvod, kradou, žaloba, policie"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
            />
            <button className="btn-primary">Uložit</button>
          </form>
          {settings.criticalKeywords.length > 0 && (
            <div className="text-xs text-slate-500">
              Aktivní: {settings.criticalKeywords.map((k) => (
                <span key={k} className="inline-block bg-red-100 text-red-800 rounded px-1.5 py-0.5 mr-1">
                  {k}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {ready && (
        <section className="bg-white rounded shadow-sm p-4">
          <h2 className="font-semibold mb-2">Kontrola připravenosti</h2>
          <ul className="text-sm space-y-1">
            {Object.entries(ready.checks).map(([k, v]) => (
              <li key={k} className="flex gap-2 items-center">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    v.ok ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <span className="font-medium w-40">{k}</span>
                <span className={v.ok ? "text-slate-600" : "text-red-700"}>
                  {v.ok ? "OK" : "PROBLÉM"} {v.detail ? `— ${v.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Aktivní účty</div>
          <div className="text-2xl font-bold">{status?.activeAccounts ?? "—"}</div>
        </div>
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Čeká na moderaci</div>
          <div className="text-2xl font-bold">{status?.pending ?? "—"}</div>
        </div>
        <div className="bg-white rounded shadow-sm p-4">
          <div className="text-xs text-slate-500">Akce za 24 h</div>
          <div className="text-2xl font-bold">{status?.actions24h ?? "—"}</div>
        </div>
      </section>

      <section className="bg-white rounded shadow-sm p-4 space-y-3">
        <h2 className="font-semibold">Operační akce</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={async () => {
              push("Spouštím polling…");
              const r = await api.adminPollRun();
              push(`Polling hotov: ${r.classified} nově klasifikováno`);
              await load();
            }}
          >
            Spustit polling teď
          </button>
          <button
            className="btn-muted"
            onClick={async () => {
              await api.adminTokenCheck();
              push("Token check spuštěn");
            }}
          >
            Zkontrolovat expiraci tokenů
          </button>
          <button
            className="btn-muted"
            onClick={async () => {
              await api.adminTestNotify();
              push("Testovací notifikace odeslána");
            }}
          >
            Test notifikace
          </button>
        </div>

        <div className="border-t pt-3">
          <h3 className="font-medium mb-2">Hromadná reklasifikace</h3>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500">Poslední … hodin</label>
              <input
                type="number"
                className="border border-slate-300 rounded px-2 py-1 text-sm w-32"
                value={reclassifyHours}
                onChange={(e) => setReclassifyHours(Number(e.target.value))}
              />
            </div>
            <button
              className="btn-primary"
              onClick={async () => {
                if (!confirm(`Překlasifikovat všechny komentáře za posledních ${reclassifyHours} h?`)) return;
                push(`Spouštím reklasifikaci (posledních ${reclassifyHours} h)…`);
                try {
                  const r = await api.adminBulkReclassify(reclassifyHours);
                  push(`Reklasifikace: ${r.done}/${r.attempted} úspěšně (${r.failed} selhalo)`);
                } catch (e) {
                  push(`Reklasifikace selhala: ${e}`);
                }
              }}
            >
              Spustit reklasifikaci
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vytvoří novou klasifikaci ke každému komentáři (historie zůstává). Užitečné po úpravě
            systémového promptu.
          </p>
        </div>

        <div className="border-t pt-3">
          <h3 className="font-medium mb-2">GDPR retence (anonymizace)</h3>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500">Retence (dní)</label>
              <input
                type="number"
                className="border border-slate-300 rounded px-2 py-1 text-sm w-32"
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
              />
            </div>
            <button
              className="btn-warn"
              onClick={async () => {
                if (!confirm(`Opravdu anonymizovat komentáře starší než ${retention} dní?`)) return;
                const r = await api.adminRetention(retention);
                push(`Anonymizováno ${r.anonymized} záznamů (retence ${r.retentionDays} dní)`);
              }}
            >
              Spustit retenci
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Anonymizuje autora a text komentářů starších než zadaný počet dní. Audit log zůstane zachován.
          </p>
        </div>
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <h2 className="font-semibold mb-2">Log</h2>
        <ul className="text-xs font-mono space-y-1 max-h-64 overflow-auto">
          {log.length === 0 && <li className="text-slate-500">Zatím nic</li>}
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
