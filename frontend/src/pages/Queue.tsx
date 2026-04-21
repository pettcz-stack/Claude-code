import { useEffect, useMemo, useRef, useState } from "react";
import { api, type CommentItem } from "../api";
import CategoryPill from "../components/CategoryPill";
import CommentDrawer from "../components/CommentDrawer";
import Stars from "../components/Stars";
import { useAuth } from "../auth";

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
  const { can } = useAuth();
  const canDelete = can("admin");
  const canWrite = can(["admin", "moderator"]);
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState({ status: "classified", platform: "", category: "" });
  const [summary, setSummary] = useState<{ totalPending: number; actioned24h: number } | null>(null);
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [reclassifying, setReclassifying] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof api.listTemplates>>>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [replyEnabled, setReplyEnabled] = useState(false);
  const itemRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        api.listComments({
          status: filter.status || undefined,
          platform: filter.platform || undefined,
          category: filter.category || undefined,
          q: search || undefined,
          limit: "200",
        }),
        api.summary(),
      ]);
      setItems(data.items);
      setSummary(s);
      setSelected(new Set());
      setCursor(0);
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
  }, [filter.status, filter.platform, filter.category, search]);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setReplyEnabled(s.replyEnabled))
      .catch(() => setReplyEnabled(false));
  }, []);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (replyTarget) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "?") {
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }
      if (items.length === 0) return;
      const cur = items[cursor];

      if (e.key === "j") {
        setCursor((c) => Math.min(items.length - 1, c + 1));
      } else if (e.key === "k") {
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "g") {
        setCursor(0);
      } else if (e.key === "G") {
        setCursor(items.length - 1);
      } else if (e.key === "h" && cur && canWrite) {
        await doAction(cur.id, "hide");
      } else if (e.key === "x" && cur && canDelete) {
        if (confirm(`Smazat komentář od ${cur.authorName ?? "(anonym)"}?`)) await doAction(cur.id, "delete");
      } else if (e.key === "p" && cur && canWrite) {
        await doAction(cur.id, "keep");
      } else if (e.key === "r" && cur && replyEnabled && canWrite) {
        setReplyTarget(cur);
        setReplyText("");
      } else if (e.key === "o" && cur?.post.permalink) {
        window.open(cur.post.permalink, "_blank", "noopener,noreferrer");
      } else if (e.key === " " && cur) {
        e.preventDefault();
        toggle(cur.id);
      } else if (e.key === "Enter" && cur) {
        setDrawerId(cur.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, cursor, replyTarget, replyEnabled, canDelete, canWrite]);

  useEffect(() => {
    const row = itemRefs.current[cursor];
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  useEffect(() => {
    if (!replyTarget) return;
    api
      .listTemplates(replyTarget.classification?.category ?? undefined)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [replyTarget]);

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

  const doAction = async (id: string, action: string): Promise<boolean> => {
    const res = await api.action(id, action);
    if (!res.success) alert(`Akce selhala: ${res.error ?? "neznámá chyba"}`);
    await load();
    return res.success;
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
        <div>
          <label className="block text-xs text-slate-500">Hledat</label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
            className="flex gap-1"
          >
            <input
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="text, autor…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn-muted"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
              >
                ×
              </button>
            )}
          </form>
        </div>
        <button className="btn-muted" onClick={load} disabled={loading}>
          {loading ? "Načítám…" : "Obnovit"}
        </button>
        <a className="btn-muted" href="/api/comments/export.csv">
          Export CSV
        </a>
        <button className="btn-muted" onClick={() => setShowHelp(true)} title="Klávesové zkratky (?)">
          ?
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

      {selected.size > 0 && canWrite && (
        <div className="flex gap-2 items-center p-2 bg-brand-50 rounded">
          <span className="text-sm">Označeno: {selected.size}</span>
          <button className="btn-warn" onClick={() => doBulk("hide")}>
            Skrýt vše
          </button>
          {canDelete && (
            <button className="btn-danger" onClick={() => doBulk("delete")}>
              Smazat vše
            </button>
          )}
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
            {items.map((c, idx) => {
              const cls = c.classification;
              const rec = cls?.recommendedAction;
              const isCursor = idx === cursor;
              return (
                <tr
                  key={c.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  className={`border-t border-slate-100 align-top ${
                    isCursor ? "bg-brand-50 outline outline-2 outline-brand-500" : ""
                  }`}
                >
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
                  <td className="p-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {c.authorPhotoUrl ? (
                        <img src={c.authorPhotoUrl} alt="" className="w-6 h-6 rounded-full" />
                      ) : null}
                      <span>{c.authorName ?? "—"}</span>
                    </div>
                    {typeof c.starRating === "number" && c.starRating > 0 && (
                      <div className="mt-1 text-sm">
                        <Stars value={c.starRating} />
                      </div>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <span
                      className={`pill ${
                        c.post.account.source === "GOOGLE"
                          ? "bg-red-100 text-red-800 ring-red-300"
                          : c.post.account.platform === "FB"
                            ? "bg-blue-100 text-blue-800 ring-blue-300"
                            : "bg-pink-100 text-pink-800 ring-pink-300"
                      }`}
                    >
                      {c.post.account.source === "GOOGLE" ? "Google" : c.post.account.platform}
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
                      {/* Google reviews can't be hidden or deleted by the
                          business owner. We only offer Keep / Reply / Flag. */}
                      {canWrite && c.post.account.source !== "GOOGLE" && (
                        <button className="btn-warn" onClick={() => doAction(c.id, "hide")}>
                          Skrýt
                        </button>
                      )}
                      {canDelete && c.post.account.source !== "GOOGLE" && (
                        <button className="btn-danger" onClick={() => doAction(c.id, "delete")}>
                          Smazat
                        </button>
                      )}
                      {canWrite && (
                        <button className="btn-muted" onClick={() => doAction(c.id, "keep")}>
                          Ponechat
                        </button>
                      )}
                      {canWrite && c.post.account.source === "GOOGLE" && (
                        <button
                          className="btn-danger"
                          title="Otevře Google Maps recenzi — ručně klikni 'Nahlásit jako nevhodnou'"
                          onClick={async () => {
                            const ok = await doAction(c.id, "flag_for_report");
                            if (ok && c.sourceUrl) {
                              window.open(c.sourceUrl, "_blank", "noopener,noreferrer");
                            } else if (ok) {
                              alert(
                                "Google neposkytuje API pro nahlášení. Otevři Google Maps, najdi recenzi a klikni na tři tečky → Nahlásit recenzi."
                              );
                            }
                          }}
                        >
                          Nahlásit Googlu
                        </button>
                      )}
                      {replyEnabled && (
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setReplyTarget(c);
                            setReplyText("");
                          }}
                        >
                          Odpovědět
                        </button>
                      )}
                      <button
                        className="btn-muted"
                        title="Detail komentáře (Enter)"
                        onClick={() => setDrawerId(c.id)}
                      >
                        i
                      </button>
                      <button
                        className="btn-muted"
                        disabled={reclassifying === c.id}
                        title="Překlasifikovat (smart model)"
                        onClick={async () => {
                          setReclassifying(c.id);
                          try {
                            await api.reclassify(c.id, true);
                            await load();
                          } finally {
                            setReclassifying(null);
                          }
                        }}
                      >
                        {reclassifying === c.id ? "…" : "↻"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerId && <CommentDrawer id={drawerId} onClose={() => setDrawerId(null)} />}

      {showHelp && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded shadow-lg w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3">Klávesové zkratky</h3>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["j / k", "další / předchozí komentář"],
                  ["g / G", "začátek / konec seznamu"],
                  ["Mezerník", "označit / odznačit"],
                  ["Enter", "detail aktuálního komentáře"],
                  ["h", "skrýt aktuální"],
                  ["x", "smazat aktuální (s potvrzením)"],
                  ["p", "ponechat aktuální"],
                  ["r", "odpovědět (otevře modal)"],
                  ["o", "otevřít permalink v novém tabu"],
                  ["?", "zobrazit / skrýt tuto nápovědu"],
                  ["Esc", "zavřít okno"],
                ].map(([k, desc]) => (
                  <tr key={k}>
                    <td className="py-1 pr-3">
                      <kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono">
                        {k}
                      </kbd>
                    </td>
                    <td className="text-slate-700">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-right">
              <button className="btn-muted" onClick={() => setShowHelp(false)}>
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

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
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Šablona:</label>
                <select
                  className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!id) return;
                    try {
                      const r = await api.renderTemplate(id, {
                        author: replyTarget.authorName ?? "",
                      });
                      setReplyText(r.rendered);
                    } catch (err) {
                      alert(`Šablona selhala: ${err}`);
                    }
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="">— vybrat —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.category ? ` (${t.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm min-h-[120px]"
              placeholder="Text odpovědi v češtině, zdvořilý tón, žádné osobní útoky."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn-muted"
                disabled={suggesting}
                onClick={async () => {
                  if (!replyTarget) return;
                  setSuggesting(true);
                  try {
                    const r = await api.suggestReply(replyTarget.id);
                    setReplyText(r.suggestion);
                  } catch (e) {
                    alert(`Návrh selhal: ${e}`);
                  } finally {
                    setSuggesting(false);
                  }
                }}
              >
                {suggesting ? "Generuji…" : "Navrhnout odpověď (AI)"}
              </button>
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
