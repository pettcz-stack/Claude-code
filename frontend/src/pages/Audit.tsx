import { useEffect, useState } from "react";
import { api } from "../api";

type Row = Awaited<ReturnType<typeof api.listActions>>["items"][number];
type EvidenceRow = Awaited<ReturnType<typeof api.listEvidence>>["items"][number];

export default function Audit() {
  const [tab, setTab] = useState<"actions" | "evidence">("actions");
  const [rows, setRows] = useState<Row[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [filter, setFilter] = useState({ from: "", to: "", performedBy: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "actions") {
        const res = await api.listActions({
          from: filter.from || undefined,
          to: filter.to || undefined,
          performedBy: filter.performedBy || undefined,
          limit: "500",
        });
        setRows(res.items);
      } else {
        const res = await api.listEvidence({
          from: filter.from || undefined,
          to: filter.to || undefined,
        });
        setEvidence(res.items);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const exportUrl = () => {
    const qs = new URLSearchParams();
    if (filter.from) qs.set("from", filter.from);
    if (filter.to) qs.set("to", filter.to);
    return `/api/audit/export.csv?${qs.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <button
          className={`btn ${tab === "actions" ? "btn-primary" : "btn-muted"}`}
          onClick={() => setTab("actions")}
        >
          Akce
        </button>
        <button
          className={`btn ${tab === "evidence" ? "btn-primary" : "btn-muted"}`}
          onClick={() => setTab("evidence")}
        >
          Evidence snapshots
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500">Od</label>
          <input
            type="date"
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Do</label>
          <input
            type="date"
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Operátor</label>
          <input
            className="border border-slate-300 rounded px-2 py-1 text-sm"
            placeholder="auto / email"
            value={filter.performedBy}
            onChange={(e) => setFilter({ ...filter, performedBy: e.target.value })}
          />
        </div>
        <button className="btn-primary" onClick={load} disabled={loading}>
          Použít filtr
        </button>
        <a className="btn-muted" href={exportUrl()}>
          Export CSV
        </a>
      </div>

      {tab === "evidence" ? (
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Čas</th>
                <th className="p-2 text-left">Kategorie</th>
                <th className="p-2 text-left">Content hash</th>
                <th className="p-2 text-left">Permalink</th>
                <th className="p-2 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="p-2 whitespace-nowrap">{new Date(e.capturedAt).toLocaleString("cs-CZ")}</td>
                  <td className="p-2">
                    <span className="pill bg-red-100 text-red-800 ring-red-300">{e.category}</span>
                  </td>
                  <td className="p-2 font-mono text-xs text-slate-500" title={e.contentHash}>
                    {e.contentHash.slice(0, 16)}…
                  </td>
                  <td className="p-2">
                    {e.permalinkAtCapture ? (
                      <a className="text-brand-700 hover:underline" href={e.permalinkAtCapture} target="_blank" rel="noreferrer">
                        otevřít
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <a className="btn-muted" href={`/api/audit/evidence/${e.id}`}>
                      Stáhnout JSON
                    </a>
                  </td>
                </tr>
              ))}
              {evidence.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    Žádné snapshoty
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2 text-left">Čas</th>
              <th className="p-2 text-left">Akce</th>
              <th className="p-2 text-left">Operátor</th>
              <th className="p-2 text-left">Výsledek</th>
              <th className="p-2 text-left">Platforma</th>
              <th className="p-2 text-left">Autor</th>
              <th className="p-2 text-left">Komentář</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="p-2 whitespace-nowrap">{new Date(r.performedAt).toLocaleString("cs-CZ")}</td>
                <td className="p-2">
                  <span className="pill bg-slate-100 text-slate-700 ring-slate-300">{r.actionType}</span>
                </td>
                <td className="p-2 whitespace-nowrap">{r.performedBy}</td>
                <td className="p-2">
                  {r.success ? (
                    <span className="text-emerald-700">OK</span>
                  ) : (
                    <span className="text-red-700">{r.errorMessage ?? "fail"}</span>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {r.comment.post.account.platform} — {r.comment.post.account.pageName}
                </td>
                <td className="p-2 whitespace-nowrap">{r.comment.authorName ?? "—"}</td>
                <td className="p-2 max-w-md">
                  <div className="line-clamp-3 break-words">{r.comment.text}</div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  Žádné záznamy
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
