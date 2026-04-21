import { useEffect, useState } from "react";

interface Template {
  id: string;
  name: string;
  category: string | null;
  body: string;
  language: string | null;
  enabled: boolean;
}

const CATEGORIES = [
  { v: "", label: "(jakákoliv)" },
  { v: "legitimate_criticism", label: "legitimate_criticism" },
  { v: "neutral", label: "neutral" },
  { v: "positive", label: "positive" },
  { v: "brand_attack", label: "brand_attack" },
  { v: "vulgarity", label: "vulgarity" },
  { v: "spam", label: "spam" },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

export default function Templates() {
  const [items, setItems] = useState<Template[]>([]);
  const [form, setForm] = useState({ name: "", category: "", body: "", language: "cs" });

  const load = async () => setItems(await api<Template[]>("/api/templates"));
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim() || !form.body.trim()) return alert("Název a tělo jsou povinné.");
    await api("/api/templates", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        body: form.body,
        category: form.category || null,
        language: form.language || null,
      }),
    });
    setForm({ name: "", category: "", body: "", language: "cs" });
    await load();
  };

  const toggle = async (t: Template) => {
    await api(`/api/templates/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !t.enabled }),
    });
    await load();
  };

  const remove = async (t: Template) => {
    if (!confirm(`Smazat šablonu "${t.name}"?`)) return;
    await api(`/api/templates/${t.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded shadow-sm p-4">
        <h2 className="font-semibold mb-3">Šablony odpovědí</h2>
        <p className="text-sm text-slate-500 mb-3">
          V těle můžeš použít zástupné znaky <code>{"{author}"}</code>. Při kategorii se šablona nabídne
          jen u odpovídajících komentářů; bez kategorie je univerzální.
        </p>
        <table className="w-full text-sm">
          <thead className="text-slate-600 text-left">
            <tr>
              <th className="p-2">Název</th>
              <th className="p-2">Kategorie</th>
              <th className="p-2">Jazyk</th>
              <th className="p-2">Náhled</th>
              <th className="p-2">Aktivní</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 align-top">
                <td className="p-2">{t.name}</td>
                <td className="p-2">{t.category ?? "—"}</td>
                <td className="p-2">{t.language ?? "—"}</td>
                <td className="p-2 text-slate-600 max-w-md">
                  <div className="line-clamp-2 whitespace-pre-wrap">{t.body}</div>
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    title="Vypnutá šablona se nenabídne v reply modalu (ale zůstává v seznamu pro znovu-zapnutí)."
                    onChange={() => toggle(t)}
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    className="btn-danger"
                    title="Trvale smaže šablonu. Historické odpovědi, které vycházely z této šablony, zůstanou zachované."
                    onClick={() => remove(t)}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  Žádné šablony. Přidej první níže.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 border-t pt-4 space-y-2">
          <h3 className="font-medium">Nová šablona</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="Název"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="cs / sk / en / de / pl"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            />
          </div>
          <textarea
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm min-h-[100px]"
            placeholder="Tělo odpovědi (můžeš použít {author})…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="text-right">
            <button
              className="btn-primary"
              title="Uloží novou šablonu. Bude okamžitě k dispozici v reply modalu, filtrovaná podle kategorie (pokud nastavená)."
              onClick={create}
            >
              Přidat šablonu
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
