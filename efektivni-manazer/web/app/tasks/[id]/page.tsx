"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import {
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconCopy,
  IconSparkles,
  IconTag,
  IconX,
} from "@/components/Icon";
import { PhaseBadge } from "@/components/PhaseBadge";
import { api, Task } from "@/lib/api";
import { deadlineLabel, PHASE_LABEL, PRIORITY_DOT, PRIORITY_LABEL } from "@/lib/ui";

type ThreadDetail = {
  id: number;
  subject: string;
  participants: string[];
  messages: {
    id: number;
    direction: string;
    from_addr: string;
    to_addrs: string[];
    subject: string;
    date: string;
    body_text: string;
  }[];
  tasks: Task[];
};

const PHASES_DELEGATED = [
  "new",
  "awaiting_ack",
  "awaiting_eta",
  "in_progress",
  "awaiting_result",
  "done",
  "dropped",
];
const PHASES_MINE = ["new", "acked", "in_progress", "blocked", "done"];

function MarkdownLite({ text }: { text: string }) {
  // Velmi jednoduchý renderer pro ## / - / **
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h4 key={i} className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand">
              {line.replace(/^##\s+/, "")}
            </h4>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 text-ink">
              <span className="text-muted">•</span>
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^-\s+/, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return (
          <div
            key={i}
            className="text-ink"
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}
          />
        );
      })}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = Number(params.id);

  const [task, setTask] = useState<Task | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const savedNotesRef = useRef("");

  const [draftTone, setDraftTone] = useState<"friendly" | "formal" | "urgent">("friendly");
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const [copiedDraft, setCopiedDraft] = useState(false);

  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryErr, setSummaryErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const t = await api<Task>(`/tasks/${taskId}`);
        const th = await api<ThreadDetail>(`/threads/${t.thread_id}`);
        setTask(t);
        setThread(th);
        const initialNotes = t.manual_overrides?.notes || "";
        setNotes(initialNotes);
        savedNotesRef.current = initialNotes;
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  async function update(payload: Partial<Task> | Record<string, any>) {
    const t = await api<Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setTask(t);
    return t;
  }

  // Auto-save notes po 1.5s nečinnosti
  useEffect(() => {
    if (loading) return;
    if (notes === savedNotesRef.current) return;
    const handle = setTimeout(async () => {
      try {
        await update({ notes });
        savedNotesRef.current = notes;
      } catch (e: any) {
        setErr(e.message);
      }
    }, 1500);
    return () => clearTimeout(handle);
  }, [notes, loading]);

  async function addTag(tag: string) {
    const clean = tag.trim().replace(/^#/, "");
    if (!clean || !task) return;
    const existing = task.manual_overrides?.tags || [];
    if (existing.includes(clean)) return;
    await update({ tags: [...existing, clean] });
    setTagInput("");
  }
  async function removeTag(tag: string) {
    if (!task) return;
    const existing = task.manual_overrides?.tags || [];
    await update({ tags: existing.filter((x: string) => x !== tag) });
  }

  async function generateDraft() {
    setDraftLoading(true);
    setDraftErr("");
    try {
      const r = await api<{ text: string }>(`/ai/tasks/${taskId}/draft-ping`, {
        method: "POST",
        body: JSON.stringify({ tone: draftTone }),
      });
      setDraftText(r.text);
    } catch (e: any) {
      setDraftErr(e.message);
    } finally {
      setDraftLoading(false);
    }
  }

  async function generateSummary() {
    if (!thread) return;
    setSummaryLoading(true);
    setSummaryErr("");
    try {
      const r = await api<{ text: string }>(
        `/ai/threads/${thread.id}/summarize`,
        { method: "POST" }
      );
      setSummaryText(r.text);
    } catch (e: any) {
      setSummaryErr(e.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(draftText);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 1500);
  }

  if (loading)
    return (
      <>
        <Nav />
        <main className="p-8 text-muted">Načítám…</main>
      </>
    );
  if (err || !task || !thread)
    return (
      <>
        <Nav />
        <main className="p-8 text-rose-300">{err || "Nenalezeno"}</main>
      </>
    );

  const phases = task.direction === "delegated" ? PHASES_DELEGATED : PHASES_MINE;
  const dl = deadlineLabel(task.deadline);
  const priority = task.manual_overrides?.priority || 0;
  const tags: string[] = task.manual_overrides?.tags || [];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <IconChevronLeft size={14} />
          Zpět
        </button>

        <header className="mb-6 flex items-start gap-4 rounded-xl border border-line bg-panel p-5">
          <Avatar
            name={task.counterpart_name}
            email={task.counterpart_email}
            size={56}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={task.phase} />
              <span className="text-xs text-muted">
                {task.direction === "delegated" ? "delegoval/a jsem" : "můj úkol"}
              </span>
              {priority > 0 && (
                <span className={`flex items-center gap-1 text-xs ${priority === 1 ? "text-rose-300" : priority === 2 ? "text-amber-300" : "text-zinc-300"}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} />
                  {PRIORITY_LABEL[priority]}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-semibold">{task.title}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {task.counterpart_name || task.counterpart_email}
              {task.counterpart_name && task.counterpart_email && (
                <span> · {task.counterpart_email}</span>
              )}
            </p>
          </div>
          {dl && (
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xs uppercase tracking-wide text-muted">
                <IconClock size={12} />
                Deadline
              </div>
              <div className={`text-lg font-semibold ${dl.style}`}>{dl.text}</div>
              <div className="text-xs text-muted">
                {task.deadline && new Date(task.deadline).toLocaleString("cs-CZ")}
              </div>
            </div>
          )}
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-panel p-4 md:col-span-1">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Stav</h3>
            <select
              value={task.phase}
              onChange={(e) => update({ phase: e.target.value as any })}
              className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm"
            >
              {phases.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABEL[p] || p}
                </option>
              ))}
            </select>

            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-muted">
              Priorita
            </h3>
            <div className="flex gap-1">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  onClick={() => update({ priority: p })}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-xs transition ${
                    priority === p
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-muted hover:bg-line"
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[p]}`} />
                  P{p}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => update({ closed: true })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
              >
                <IconCheck size={14} />
                Hotové
              </button>
              {task.closed_at && (
                <button
                  onClick={() => update({ closed: false })}
                  className="rounded border border-line px-3 py-1.5 text-sm"
                >
                  Znovu otevřít
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-panel p-4 md:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">
              Co se čeká
            </h3>
            <p className="text-sm">{task.requested_output || "—"}</p>

            <h3 className="mt-3 mb-1 text-xs font-semibold uppercase text-muted">
              Shrnutí
            </h3>
            <p className="text-sm text-muted">{task.summary || "—"}</p>

            <h3 className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
              <IconTag size={11} />
              Tagy
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="group flex items-center gap-1 rounded-full bg-line px-2 py-0.5 text-xs"
                >
                  #{t}
                  <button
                    onClick={() => removeTag(t)}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
                  >
                    <IconX size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="přidat tag…"
                className="rounded bg-bg px-2 py-0.5 text-xs outline-none placeholder:text-muted focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
        </section>

        {/* AI sekce */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-gradient-to-br from-purple-500/5 to-transparent p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <IconSparkles size={15} className="text-purple-300" />
                Vygeneruj ping
              </h3>
              <div className="flex gap-1 rounded border border-line bg-bg p-0.5 text-[10px]">
                {(["friendly", "formal", "urgent"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDraftTone(t)}
                    className={
                      "rounded px-2 py-0.5 " +
                      (draftTone === t ? "bg-purple-500/30 text-purple-100" : "text-muted")
                    }
                  >
                    {t === "friendly" ? "Přátelsky" : t === "formal" ? "Formálně" : "Urgentně"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generateDraft}
              disabled={draftLoading}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-2 text-sm font-medium text-purple-100 hover:bg-purple-500/30 disabled:opacity-50"
            >
              {draftLoading ? "Generuji…" : "Generovat draft (Claude Opus)"}
            </button>
            {draftErr && <p className="mb-2 text-xs text-rose-300">{draftErr}</p>}
            {draftText && (
              <>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={8}
                  className="w-full rounded border border-line bg-bg p-2 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={copyDraft}
                    className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs hover:bg-line"
                  >
                    {copiedDraft ? <IconCheck size={12} /> : <IconCopy size={12} />}
                    {copiedDraft ? "Zkopírováno" : "Kopírovat"}
                  </button>
                  <button
                    onClick={() => setDraftText("")}
                    className="rounded border border-line px-3 py-1.5 text-xs text-muted hover:bg-line"
                  >
                    Zahodit
                  </button>
                </div>
              </>
            )}
            {!draftText && !draftErr && !draftLoading && (
              <p className="text-xs text-muted">
                Claude napíše stručný draft pingu na základě vlákna. Zkontroluješ, upravíš
                a pošleš z Outlooku.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-gradient-to-br from-cyan-500/5 to-transparent p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <IconSparkles size={15} className="text-cyan-300" />
              Sumarizuj vlákno
            </h3>
            <button
              onClick={generateSummary}
              disabled={summaryLoading || thread.messages.length === 0}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {summaryLoading ? "Sumarizuji…" : "Sumarizovat (Claude Sonnet)"}
            </button>
            {summaryErr && <p className="mb-2 text-xs text-rose-300">{summaryErr}</p>}
            {summaryText ? (
              <div className="rounded border border-line bg-bg p-3">
                <MarkdownLite text={summaryText} />
              </div>
            ) : (
              <p className="text-xs text-muted">
                Co bylo dohodnuto, co je otevřené, co čeká akci na Tobě.
              </p>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted">
            Moje poznámky
            <span className="ml-2 text-[10px] normal-case text-muted/70">
              ({notes === savedNotesRef.current ? "uloženo" : "ukládám…"})
            </span>
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Privátní poznámky, kontext, na co nezapomenout…"
            rows={3}
            className="w-full rounded-xl border border-line bg-panel p-3 text-sm"
          />
        </section>

        {thread.messages.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">
              Vlákno · {thread.subject}
            </h3>
            <ul className="space-y-3">
              {thread.messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-xl border bg-panel p-4 ${
                    m.direction === "outbound" ? "border-brand/30" : "border-line"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-muted">
                    <span>
                      <span
                        className={
                          "mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase " +
                          (m.direction === "outbound"
                            ? "bg-brand/20 text-brand"
                            : "bg-line text-ink")
                        }
                      >
                        {m.direction === "outbound" ? "odesláno" : "přijato"}
                      </span>
                      <span className="font-medium text-ink">{m.from_addr}</span>{" "}
                      → {m.to_addrs.join(", ")}
                    </span>
                    <span>{new Date(m.date).toLocaleString("cs-CZ")}</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                    {m.body_text?.slice(0, 4000)}
                  </pre>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
