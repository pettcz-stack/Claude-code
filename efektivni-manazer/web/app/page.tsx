"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { PhaseBadge } from "@/components/PhaseBadge";
import { StatCard } from "@/components/StatCard";
import { api, Notification, Overview, Task } from "@/lib/api";
import { deadlineLabel, formatRelative, LEVEL_LABEL, LEVEL_STYLE } from "@/lib/ui";

type Filter = "all" | "delegated" | "mine" | "overdue";

function TaskCard({ t }: { t: Task }) {
  const dl = deadlineLabel(t.deadline);
  return (
    <Link
      href={`/tasks/${t.id}`}
      className="group flex items-start gap-3 border-b border-line px-4 py-3 transition hover:bg-line/40"
    >
      <Avatar name={t.counterpart_name} email={t.counterpart_email} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium text-ink group-hover:text-brand">
            {t.title || "(bez nadpisu)"}
          </div>
          <PhaseBadge phase={t.phase} />
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {t.counterpart_name || t.counterpart_email || "—"}
          {t.summary && <span> · {t.summary.slice(0, 100)}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        {dl && <div className={`font-medium ${dl.style}`}>{dl.text}</div>}
        <div className="text-muted">{formatRelative(t.last_activity_at)}</div>
      </div>
    </Link>
  );
}

function NotificationCard({
  n,
  task,
  onSnooze,
  onDismiss,
}: {
  n: Notification;
  task?: Task;
  onSnooze: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border-l-4 bg-panel px-4 py-3 ${LEVEL_STYLE[n.level] || ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-semibold uppercase">{LEVEL_LABEL[n.level]}</span>
          <span>·</span>
          <span>{formatRelative(n.created_at)}</span>
        </div>
        <div className="mt-0.5 font-medium text-ink">{n.message}</div>
        {task && (
          <Link
            href={`/tasks/${task.id}`}
            className="mt-1 inline-block text-sm text-brand hover:underline"
          >
            {task.title}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onSnooze(n.id)}
          className="rounded border border-line px-2 py-1 text-xs text-muted hover:bg-line"
          title="Odložit o 4 hodiny"
        >
          Snooze 4h
        </button>
        <button
          onClick={() => onDismiss(n.id)}
          className="rounded border border-line px-2 py-1 text-xs text-muted hover:bg-line"
          title="Označit jako vyřízené"
        >
          Vyřízeno
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    try {
      const [o, t, n] = await Promise.all([
        api<Overview>("/stats/overview"),
        api<Task[]>("/tasks?open_only=true"),
        api<Notification[]>("/notifications?open_only=true"),
      ]);
      setOverview(o);
      setTasks(t);
      setNotifs(n);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const tasksByDir = useMemo(() => {
    const q = search.toLowerCase().trim();
    const match = (t: Task) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.counterpart_name.toLowerCase().includes(q) ||
      t.counterpart_email.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q);

    const now = Date.now();
    const overdue = (t: Task) => t.deadline && new Date(t.deadline).getTime() < now;

    let filtered = tasks.filter(match);
    if (filter === "delegated") filtered = filtered.filter((t) => t.direction === "delegated");
    else if (filter === "mine") filtered = filtered.filter((t) => t.direction === "mine");
    else if (filter === "overdue") filtered = filtered.filter(overdue);

    return {
      delegated: filtered.filter((t) => t.direction === "delegated"),
      mine: filtered.filter((t) => t.direction === "mine"),
    };
  }, [tasks, filter, search]);

  const taskMap = useMemo(() => {
    const m = new Map<number, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  async function snooze(id: number) {
    await api(`/notifications/${id}/snooze?hours=4`, { method: "POST" });
    setNotifs((cur) => cur.filter((x) => x.id !== id));
  }
  async function dismiss(id: number) {
    await api(`/notifications/${id}/dismiss`, { method: "POST" });
    setNotifs((cur) => cur.filter((x) => x.id !== id));
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted">
              {loading ? "Načítám…" : "Stav úkolů a co dnes vyžaduje pozornost."}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
          >
            + Nový úkol
          </button>
        </div>

        {err && (
          <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        {/* Stats row */}
        {overview && (
          <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Otevřených" value={overview.open} hint="celkem aktivních" />
            <StatCard
              label="Po termínu"
              value={overview.overdue}
              tone={overview.overdue > 0 ? "danger" : "default"}
              hint="urgovat"
            />
            <StatCard label="Moje úkoly" value={overview.mine_open} hint="já musím odpovědět" />
            <StatCard
              label="Čekám na"
              value={overview.delegated_open}
              hint="delegovaných čeká na akci"
            />
          </section>
        )}

        {/* Notifikace */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Akce dnes ({notifs.length})
          </h2>
          {loading ? (
            <div className="rounded-lg border border-line bg-panel px-4 py-6 text-center text-muted">
              Načítám…
            </div>
          ) : notifs.length === 0 ? (
            <div className="rounded-lg border border-line bg-panel px-4 py-6 text-center text-muted">
              ✓ Nic, co by hořelo. Můžeš si dát kávu.
            </div>
          ) : (
            <div className="space-y-2">
              {notifs.map((n) => (
                <NotificationCard
                  key={n.id}
                  n={n}
                  task={taskMap.get(n.task_id)}
                  onSnooze={snooze}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </section>

        {/* Hledání + filtry */}
        <section className="mb-4 flex flex-wrap items-center gap-3">
          <input
            placeholder="Hledat v úkolech…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="flex gap-1 rounded-lg border border-line bg-panel p-1 text-xs">
            {(["all", "mine", "delegated", "overdue"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1.5 ${
                  filter === f ? "bg-brand text-bg" : "text-muted hover:text-ink"
                }`}
              >
                {f === "all" ? "Vše" : f === "mine" ? "Moje" : f === "delegated" ? "Čekám na" : "Po termínu"}
              </button>
            ))}
          </div>
        </section>

        {/* Dvojí sloupec úkolů */}
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted">
              <span>Moje úkoly</span>
              <span className="rounded bg-line px-2 py-0.5 text-xs">{tasksByDir.mine.length}</span>
            </h2>
            <div className="overflow-hidden rounded-lg border border-line bg-panel">
              {tasksByDir.mine.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Žádné otevřené úkoly pro Tebe.
                </p>
              ) : (
                tasksByDir.mine.map((t) => <TaskCard key={t.id} t={t} />)
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted">
              <span>Čekám na ostatní</span>
              <span className="rounded bg-line px-2 py-0.5 text-xs">{tasksByDir.delegated.length}</span>
            </h2>
            <div className="overflow-hidden rounded-lg border border-line bg-panel">
              {tasksByDir.delegated.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Žádné delegované úkoly.
                </p>
              ) : (
                tasksByDir.delegated.map((t) => <TaskCard key={t.id} t={t} />)
              )}
            </div>
          </div>
        </section>
      </main>

      <NewTaskDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => refresh()}
      />
    </>
  );
}
