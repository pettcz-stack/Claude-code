"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { api, PHASE_LABEL, Task } from "@/lib/api";

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

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = Number(params.id);

  const [task, setTask] = useState<Task | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const t = await api<Task>(`/tasks/${taskId}`);
        const th = await api<ThreadDetail>(`/threads/${t.thread_id}`);
        setTask(t);
        setThread(th);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  async function update(payload: Partial<Task> | { closed: boolean }) {
    const t = await api<Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setTask(t);
  }

  if (loading) return <><Nav /><main className="p-8 text-muted">Načítám…</main></>;
  if (err || !task || !thread)
    return <><Nav /><main className="p-8 text-danger">{err || "Nenalezeno"}</main></>;

  const phases = task.direction === "delegated" ? PHASES_DELEGATED : PHASES_MINE;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <button onClick={() => router.back()} className="mb-4 text-sm text-muted hover:text-ink">
          ← Zpět
        </button>

        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {task.direction === "delegated" ? "Delegoval/a jsem" : "Můj úkol"} ·{" "}
          {task.counterpart_name || task.counterpart_email}
        </p>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded border border-line bg-panel p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Stav</h3>
            <select
              value={task.phase}
              onChange={(e) => update({ phase: e.target.value as any })}
              className="w-full rounded border border-line bg-bg px-2 py-1.5"
            >
              {phases.map((p) => (
                <option key={p} value={p}>{PHASE_LABEL[p] || p}</option>
              ))}
            </select>
            <p className="mt-3 text-xs text-muted">
              Deadline: {task.deadline ? new Date(task.deadline).toLocaleString("cs-CZ") : "—"}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => update({ closed: true })}
                className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-bg"
              >
                Označit hotové
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
          <div className="rounded border border-line bg-panel p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Co se čeká</h3>
            <p className="text-sm">{task.requested_output || "—"}</p>
            <h3 className="mt-3 mb-1 text-xs font-semibold uppercase text-muted">Shrnutí</h3>
            <p className="text-sm text-muted">{task.summary || "—"}</p>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted">
            Vlákno · {thread.subject}
          </h3>
          <ul className="space-y-3">
            {thread.messages.map((m) => (
              <li key={m.id} className="rounded border border-line bg-panel p-4">
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
                    {m.from_addr} → {m.to_addrs.join(", ")}
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
      </main>
    </>
  );
}
