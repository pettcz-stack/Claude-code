import { useEffect, useState } from "react";
import { api, type Rule } from "../api";

const AUTO_CATEGORIES = ["spam", "vulgarity"];

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [paused, setPaused] = useState(false);
  const [form, setForm] = useState<{ name: string; category: string; minConfidence: number; action: "hide" | "delete" }>({
    name: "",
    category: "spam",
    minConfidence: 0.9,
    action: "delete",
  });
  const [lists, setLists] = useState<Array<{ id: string; kind: string; value: string }>>([]);
  const [newListEntry, setNewListEntry] = useState({ kind: "whitelist_author", value: "" });

  const load = async () => {
    const [r, p, l] = await Promise.all([api.listRules(), api.getPause(), api.listLists()]);
    setRules(r);
    setPaused(p.paused);
    setLists(l);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!form.name.trim()) return alert("Zadejte název");
    try {
      await api.createRule({ ...form, enabled: true });
      setForm({ name: "", category: "spam", minConfidence: 0.9, action: "delete" });
      await load();
    } catch (e) {
      alert(String(e));
    }
  };

  const toggle = async (r: Rule) => {
    await api.updateRule(r.id, { enabled: !r.enabled });
    await load();
  };

  const remove = async (r: Rule) => {
    if (!confirm(`Smazat pravidlo "${r.name}"?`)) return;
    await api.deleteRule(r.id);
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Automatická moderace</h2>
          <p className="text-sm text-slate-500">
            Pozastavením se dočasně zastaví veškeré auto-akce. Ruční moderace funguje dál.
          </p>
        </div>
        <button
          className={paused ? "btn-primary" : "btn-warn"}
          title={
            paused
              ? "Znovu zapne automatickou moderaci. Spam s confidence ≥90 % se začne mazat, vulgarita ≥85 % skrývat automaticky."
              : "Dočasně zastaví VŠECHNY automatické akce (auto-delete, auto-hide). Ruční moderace funguje dál. Vhodné při krizi nebo testování nového promptu."
          }
          onClick={async () => {
            await api.setPause(!paused);
            await load();
          }}
        >
          {paused ? "Obnovit auto-moderaci" : "Pozastavit auto-moderaci"}
        </button>
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <h2 className="font-semibold mb-3">Pravidla</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-600 text-left">
            <tr>
              <th className="p-2">Název</th>
              <th className="p-2">Kategorie</th>
              <th className="p-2">Min. confidence</th>
              <th className="p-2">Akce</th>
              <th className="p-2">Aktivní</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.category}</td>
                <td className="p-2">{Math.round(r.minConfidence * 100)}%</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    title="Zapíná/vypíná toto konkrétní pravidlo. Vypnuté pravidlo zůstává v seznamu, ale neaplikuje se na nové komentáře."
                    onChange={() => toggle(r)}
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    className="btn-danger"
                    title="Trvale smaže pravidlo. Historické akce, které podle něj proběhly, zůstanou v audit logu."
                    onClick={() => remove(r)}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  Žádná vlastní pravidla. Výchozí pravidla se aplikují z env nastavení.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 border-t pt-4">
          <h3 className="font-medium mb-2">Nové pravidlo</h3>
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="Název"
              title="Interní název pravidla, jen pro tvoji orientaci. Např. 'Tvrdý spam' nebo 'Jemná vulgarita'."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              title="Na kterou AI kategorii se pravidlo aplikuje. Bezpečnostní zámek: brand_attack a legitimate_criticism nelze."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {AUTO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              className="border border-slate-300 rounded px-2 py-1 text-sm w-24"
              title="Minimální jistota AI, od které se pravidlo aplikuje. 0.9 znamená 'AI si je jistá na 90 % nebo víc'. Doporučení: spam 0.9, vulgarita 0.85."
              value={form.minConfidence}
              onChange={(e) => setForm({ ...form, minConfidence: Number(e.target.value) })}
            />
            <select
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              title="Co aplikace udělá automaticky, když pravidlo sedne. hide = skrýt, delete = smazat (nevratné)."
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value as "hide" | "delete" })}
            >
              <option value="hide">hide</option>
              <option value="delete">delete</option>
            </select>
            <button
              className="btn-primary"
              title="Vytvoří nové pravidlo. Okamžitě se aktivuje pro nové komentáře (staré komentáře se neaplikují zpětně)."
              onClick={submit}
            >
              Přidat
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Kategorie <code>brand_attack</code> a <code>legitimate_criticism</code> nelze automatizovat z
            bezpečnostních důvodů.
          </p>
        </div>
      </section>

      <section className="bg-white rounded shadow-sm p-4">
        <h2 className="font-semibold mb-3">Whitelist / Blacklist</h2>
        <p className="text-sm text-slate-500 mb-2">
          💡 <b>Whitelist autora</b> — tohoto uživatele auto-moderace nikdy neskryje/nesmaže (např. VIP klient).<br />
          💡 <b>Blacklist autora</b> — tohoto uživatele se vždy auto-skryje (kromě legitimní kritiky).<br />
          💡 Whitelist/Blacklist slov zatím není aktivní ve výchozím pipelinu — rezervováno pro budoucí feature.
        </p>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            title="Zvol typ seznamu. Author = jméno nebo ID uživatele ze sociální sítě. Word = konkrétní slovo v textu."
            value={newListEntry.kind}
            onChange={(e) => setNewListEntry({ ...newListEntry, kind: e.target.value })}
          >
            <option value="whitelist_author">Whitelist autora</option>
            <option value="blacklist_author">Blacklist autora</option>
            <option value="whitelist_word">Whitelist slova</option>
            <option value="blacklist_word">Blacklist slova</option>
          </select>
          <input
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            placeholder="hodnota (jméno/ID/slovo)"
            title="Pro autora zadej přesně jméno, jak ho zobrazuje FB/IG, nebo jeho platform ID. Rozlišují se velká/malá písmena."
            value={newListEntry.value}
            onChange={(e) => setNewListEntry({ ...newListEntry, value: e.target.value })}
          />
          <button
            className="btn-primary"
            title="Přidá záznam do zvoleného seznamu. Účinnost je okamžitá pro nové komentáře."
            onClick={async () => {
              if (!newListEntry.value.trim()) return;
              await api.addListEntry(newListEntry.kind, newListEntry.value.trim());
              setNewListEntry({ ...newListEntry, value: "" });
              await load();
            }}
          >
            Přidat
          </button>
        </div>
        <ul className="divide-y">
          {lists.map((e) => (
            <li key={e.id} className="py-2 flex items-center justify-between text-sm">
              <span>
                <span className="pill bg-slate-100 text-slate-700 ring-slate-300 mr-2">{e.kind}</span>
                {e.value}
              </span>
              <button
                className="text-red-600 hover:underline text-xs"
                title="Odstraní záznam ze seznamu. Nová chování platí okamžitě."
                onClick={async () => {
                  await api.deleteListEntry(e.id);
                  await load();
                }}
              >
                Smazat
              </button>
            </li>
          ))}
          {lists.length === 0 && <li className="text-slate-500 text-sm">Prázdné</li>}
        </ul>
      </section>
    </div>
  );
}
