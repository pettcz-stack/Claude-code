"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { api, LEVEL_LABEL, Notification, PHASE_LABEL, Task } from "@/lib/api";

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "před chvílí";
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`;
  return `před ${Math.floor(diff / 86400)} dny`;
}

function TaskRow({ t }: { t: Task }) {
  return (
    <Link
      href={`/tasks/${t.id}`}
      className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 hover:bg-panel"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.title || "(bez nadpisu)"}</div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {t.counterpart_name || t.counterpart_email || "—"} ·{" "}
          {t.summary?.slice(0, 120)}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        <div className="text-muted">{PHASE_LABEL[t.phase] || t.phase}</div>
        <div className="text-muted">{formatRelative(t.last_activity_at)}</div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [t, n] = await Promise.all([
          api<Task[]>("/tasks?open_only=true"),
          api<Notification[]>("/notifications?open_only=true"),
        ]);
        setTasks(t);
        setNotifs(n);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const delegated = tasks.filter((t) => t.direction === "delegated");
  const mine = tasks.filter((t) => t.direction === "mine");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        {err && (
          <div className="mb-4 rounded border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Vyžaduje akci ode mě dnes ({notifs.length})
          </h2>
          {loading ? (
            <p className="text-muted">Načítám…</p>
          ) : notifs.length === 0 ? (
            <p className="rounded border border-line bg-panel px-4 py-3 text-sm text-muted">
              Nic, co by hořelo. ✓
            </p>
          ) : (
            <ul className="rounded border border-line bg-panel">
              {notifs.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <span
                      className={
                        "mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " +
                        (n.level === "urgent"
                          ? "bg-danger/20 text-danger"
                          : n.level === "warning"
                          ? "bg-warn/20 text-warn"
                          : "bg-line text-muted")
                      }
                    >
                      {LEVEL_LABEL[n.level]}
                    </span>
                    <span>{n.message}</span>
                    <div className="text-xs text-muted">
                      <Link
                        href={`/tasks/${n.task_id}`}
                        className="text-brand hover:underline"
                      >
                        otevřít úkol
                      </Link>{" "}
                      · {formatRelative(n.created_at)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 text-xs">
                    <button
                      onClick={async () => {
                        await api(`/notifications/${n.id}/snooze?hours=4`, {
                          method: "POST",
                        });
                        setNotifs((cur) => cur.filter((x) => x.id !== n.id));
                      }}
                      className="rounded border border-line px-2 py-1 hover:bg-line"
                    >
                      Snooze 4h
                    </button>
                    <button
                      onClick={async () => {
                        await api(`/notifications/${n.id}/dismiss`, {
                          method: "POST",
                        });
                        setNotifs((cur) => cur.filter((x) => x.id !== n.id));
                      }}
                      className="rounded border border-line px-2 py-1 hover:bg-line"
                    >
                      Hotovo
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Moje úkoly ({mine.length})
            </h2>
            <div className="rounded border border-line bg-panel">
              {mine.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Žádné otevřené.</p>
              ) : (
                mine.map((t) => <TaskRow key={t.id} t={t} />)
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Čekám na ({delegated.length})
            </h2>
            <div className="rounded border border-line bg-panel">
              {delegated.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Žádné otevřené.</p>
              ) : (
                delegated.map((t) => <TaskRow key={t.id} t={t} />)
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
