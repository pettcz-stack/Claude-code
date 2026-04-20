import { useEffect, useMemo, useState } from "react";
import { api, type CommentItem } from "../api";
import CategoryPill from "../components/CategoryPill";

const CATEGORIES = [
  "",
  "brand_attack",
  "vulgarity",
  "spam",
  "legitimate_criticism",
  "neutral",
  "positive",
];

export default function Queue() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState({ status: "classified", platform: "", category: "" });
  const [summary, setSummary] = useState<{ totalPending: number; actioned24h: number } | null>(null);
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        api.listComments({
          status: filter.status || undefined,
          platform: filter.platform || undefined,
          category: filter.category || undefined,
          limit: "200",
        }),
        api.summary(),
      ]);
      setItems(data.items);
      setSummary(s);
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.status, filter.platform, filter.category]);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => selected.has(i.id)),
    [items, selected]
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const doAction = async (id: string, action: string) => {
    const res = await api.action(id, action);
    if (!res.success) alert(`Akce selhala: ${res.error ?? "neznámá chyba"}`);
    await load();
  };

  const doBulk = async (action: string) => {
    if (selected.size === 0) return;
    if (!confirm(`Opravdu provést akci "${action}" na ${selected.size} komentářích?`)) return;
    const res = await api.bulkAction(Array.from(selected), action);
    const failed = res.results.filter((r) => !r.success);
    if (failed.length > 0) alert(`${failed.length} akcí selhalo`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-slate-500">Stav</label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="classified">Ke zpracování</option>
            <option value="new">Nové (ještě neklasifikované)</option>
            <option value="actioned">Zpracované</option>
            <option value="">Všechny</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Platforma</label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            value={filter.platform}
            onChange={(e) => setFilter({ ...filter, platform: e.target.value })}
          >
            <option value="">Vše</option>
            <option value="FB">Facebook</option>
            <option value="IG">Instagram</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Kategorie</label>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c || "Všechny"}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-muted" onClick={load} disabled={loading}>
          {loading ? "Načítám…" : "Obnovit"}
        </button>
        {summary && (
          <div className="ml-auto text-sm text-slate-500">
            <span className="mr-4">
              Čeká na moderaci: <b className="text-slate-800">{summary.totalPending}</b>
            </span>
            <span>
              Zpracováno za 24 h: <b className="text-slate-800">{summary.actioned24h}</b>
            </span>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      {selected.size > 0 && (
        <div className="flex gap-2 items-center p-2 bg-brand-50 rounded">
          <span className="text-sm">Označeno: {selected.size}</span>
          <button className="btn-warn" onClick={() => doBulk("hide")}>
            Skrýt vše
          </button>
          <button className="btn-danger" onClick={() => doBulk("delete")}>
            Smazat vše
          </button>
          <button className="btn-muted" onClick={() => doBulk("keep")}>
            Ponechat vše
          </button>
        </div>
      )}

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="w-8 p-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="p-2 text-left">Kategorie</th>
              <th className="p-2 text-left">Komentář</th>
              <th className="p-2 text-left">Autor</th>
              <th className="p-2 text-left">Platforma</th>
              <th className="p-2 text-left">Příspěvek</th>
              <th className="p-2 text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Žádné komentáře v této frontě.
                </td>
              </tr>
            )}
            {items.map((c) => {
              const cls = c.classification;
              const rec = cls?.recommendedAction;
              return (
                <tr key={c.id} className="border-t border-slate-100 align-top">
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <CategoryPill category={cls?.category} confidence={cls?.confidence} />
                    {cls?.detectedLanguage && (
                      <div className="text-xs text-slate-400 mt-1">{cls.detectedLanguage}</div>
                    )}
                    {rec === "review" && (
                      <div className="text-xs text-amber-700 mt-1">👀 doporučeno zkontrolovat</div>
                    )}
                  </td>
                  <td className="p-2 max-w-md">
                    <div className="whitespace-pre-wrap break-words">{c.text}</div>
                    {cls?.reasoning && (
                      <div className="text-xs text-slate-500 mt-1 italic">AI: {cls.reasoning}</div>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">{c.authorName ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">
                    <span className="pill bg-slate-100 text-slate-700 ring-slate-300">
                      {c.post.account.platform}
                    </span>
                    <div className="text-xs text-slate-500 mt-1">{c.post.account.pageName}</div>
                  </td>
                  <td className="p-2 max-w-xs">
                    {c.post.permalink ? (
                      <a
                        className="text-brand-700 hover:underline"
                        href={c.post.permalink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.post.contentPreview?.slice(0, 60) || "otevřít"}
                      </a>
                    ) : (
                      <span className="text-slate-500">{c.post.contentPreview?.slice(0, 60)}</span>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap text-right">
                    <div className="inline-flex gap-1">
                      <button className="btn-warn" onClick={() => doAction(c.id, "hide")}>
                        Skrýt
                      </button>
                      <button className="btn-danger" onClick={() => doAction(c.id, "delete")}>
                        Smazat
                      </button>
                      <button className="btn-muted" onClick={() => doAction(c.id, "keep")}>
                        Ponechat
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setReplyTarget(c);
                          setReplyText("");
                        }}
                      >
                        Odpovědět
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {replyTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setReplyTarget(null)}
        >
          <div
            className="bg-white rounded shadow-lg w-full max-w-xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">
              Odpovědět uživateli {replyTarget.authorName ?? "(anonym)"}
            </h3>
            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded whitespace-pre-wrap">
              {replyTarget.text}
            </div>
            <textarea
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm min-h-[120px]"
              placeholder="Text odpovědi v češtině, zdvořilý tón, žádné osobní útoky."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-muted" onClick={() => setReplyTarget(null)}>
                Zrušit
              </button>
              <button
                className="btn-primary"
                disabled={replySending || !replyText.trim()}
                onClick={async () => {
                  setReplySending(true);
                  try {
                    const r = await api.action(replyTarget.id, "reply", replyText.trim());
                    if (!r.success) alert(`Odpověď selhala: ${r.error ?? "neznámá chyba"}`);
                    setReplyTarget(null);
                    await load();
                  } finally {
                    setReplySending(false);
                  }
                }}
              >
                {replySending ? "Odesílám…" : "Odeslat odpověď"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
