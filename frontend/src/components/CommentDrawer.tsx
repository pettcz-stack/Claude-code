import { useEffect, useState } from "react";
import { api } from "../api";
import CategoryPill from "./CategoryPill";

type CommentDetail = Awaited<ReturnType<typeof api.getComment>>;

interface Props {
  id: string;
  onClose: () => void;
}

export default function CommentDrawer({ id, onClose }: Props) {
  const [data, setData] = useState<CommentDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .getComment(id)
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [id]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white w-full max-w-lg h-full shadow-xl overflow-auto p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Detail komentáře</h3>
          <button className="btn-muted" onClick={onClose}>
            ×
          </button>
        </div>

        {err && <div className="bg-red-50 text-red-700 rounded p-2 text-sm">{err}</div>}
        {!data && !err && <div className="text-slate-500 text-sm">Načítám…</div>}

        {data && (
          <>
            <section className="space-y-1">
              <div className="text-xs text-slate-500">
                {data.post.account.platform} · {data.post.account.pageName}
              </div>
              <div className="text-sm font-medium">{data.authorName ?? "(anonym)"}</div>
              {data.authorId && <div className="text-xs text-slate-400">{data.authorId}</div>}
              <div className="whitespace-pre-wrap break-words mt-2 text-slate-800 bg-slate-50 p-2 rounded">
                {data.text}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Zachyceno {new Date(data.fetchedAt).toLocaleString("cs-CZ")}
                {data.createdAtPlatform && (
                  <> · Publikováno {new Date(data.createdAtPlatform).toLocaleString("cs-CZ")}</>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Platform ID: <span className="font-mono">{data.platformCommentId}</span>
              </div>
              {data.post.permalink && (
                <a
                  className="inline-block mt-2 text-brand-700 hover:underline text-sm"
                  href={data.post.permalink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Otevřít příspěvek ↗
                </a>
              )}
            </section>

            <section>
              <h4 className="font-medium mb-2">Historie klasifikací</h4>
              {data.classifications.length === 0 && (
                <div className="text-slate-500 text-sm">Zatím žádná klasifikace.</div>
              )}
              <ul className="space-y-2">
                {data.classifications.map((c) => (
                  <li key={c.id} className="border border-slate-200 rounded p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <CategoryPill category={c.category} confidence={c.confidence} />
                      <span className="text-xs text-slate-500">
                        {new Date(c.classifiedAt).toLocaleString("cs-CZ")}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {c.modelUsed} · doporučeno: <b>{c.recommendedAction}</b>
                      {c.detectedLanguage && <> · jazyk: {c.detectedLanguage}</>}
                    </div>
                    <div className="text-xs italic text-slate-600 mt-1">{c.reasoning}</div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="font-medium mb-2">Historie akcí</h4>
              {data.actions.length === 0 && (
                <div className="text-slate-500 text-sm">Zatím žádná akce.</div>
              )}
              <ul className="space-y-2">
                {data.actions.map((a) => (
                  <li key={a.id} className="border border-slate-200 rounded p-2 text-sm flex justify-between">
                    <span>
                      <span className="pill bg-slate-100 text-slate-700 ring-slate-300 mr-1">
                        {a.actionType}
                      </span>
                      {a.performedBy}
                      {!a.success && a.errorMessage && (
                        <span className="text-red-700 text-xs block">{a.errorMessage}</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(a.performedAt).toLocaleString("cs-CZ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
