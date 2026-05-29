"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import {
  IconAlert,
  IconBell,
  IconClock,
  IconInbox,
  IconList,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconUsers,
} from "@/components/Icon";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { StatCard } from "@/components/StatCard";
import { TaskCard } from "@/components/TaskCard";
import { api, Notification, Overview, Task } from "@/lib/api";
import { formatRelative, LEVEL_LABEL, LEVEL_STYLE } from "@/lib/ui";

type Filter = "all" | "delegated" | "mine" | "overdue";

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
      className={`flex items-start gap-3 rounded-lg border-l-4 bg-panel px-4 py-3 transition hover:bg-line/30 ${LEVEL_STYLE[n.level] || ""}`}
    >
      <div className="mt-0.5">
        {n.level === "urgent" ? (
          <IconAlert size={18} />
        ) : n.level === "warning" ? (
          <IconBell size={18} />
        ) : (
          <IconInbox size={18} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
          <span className="font-semibold">{LEVEL_LABEL[n.level]}</span>
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

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center px-4 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-line/60 text-muted">
        <IconInbox size={22} />
      </div>
      <div className="text-sm font-medium text-muted">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted/70">{hint}</div>}
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
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    setRefreshing(true);
    const oP = api<Overview>("/stats/overview").catch((e) => {
      console.warn("stats/overview failed:", e.message);
      return null;
    });
    const tP = api<Task[]>("/tasks?open_only=true").catch((e) => {
      setErr((cur) => cur || `Tasks: ${e.message}`);
      return [] as Task[];
    });
    const nP = api<Notification[]>("/notifications?open_only=true").catch((e) => {
      setErr((cur) => cur || `Notifications: ${e.message}`);
      return [] as Notification[];
    });
    const [o, t, n] = await Promise.all([oP, tP, nP]);
    setOverview(o);
    setTasks(t);
    setNotifs(n);
    setLoading(false);
    setRefreshing(false);
  }
  useEffect(() => {
    refresh();
  }, []);

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
      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted">
              {loading ? "Načítám…" : "Stav úkolů a co dnes vyžaduje pozornost."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-line/60 disabled:opacity-50"
              title="Obnovit"
            >
              <IconRefresh size={15} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Obnovit</span>
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand to-emerald-400 px-4 py-2 text-sm font-semibold text-bg shadow-lg shadow-brand/20 hover:opacity-90"
            >
              <IconPlus size={15} />
              Nový úkol
            </button>
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        {/* Stats row */}
        {overview && (
          <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Otevřených"
              value={overview.open}
              hint="celkem aktivních"
              icon={<IconList size={20} />}
            />
            <StatCard
              label="Po termínu"
              value={overview.overdue}
              tone={overview.overdue > 0 ? "danger" : "default"}
              hint={overview.overdue > 0 ? "vyžaduje urgenci" : "vše v termínu"}
              icon={<IconAlert size={20} />}
            />
            <StatCard
              label="Moje úkoly"
              value={overview.mine_open}
              tone={overview.mine_open > 0 ? "info" : "default"}
              hint="vyžaduje moji odpověď"
              icon={<IconInbox size={20} />}
            />
            <StatCard
              label="Čekám na"
              value={overview.delegated_open}
              tone="good"
              hint="delegováno ostatním"
              icon={<IconSend size={20} />}
            />
          </section>
        )}

        {/* Notifikace */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <IconBell size={14} />
            Akce dnes
            <span className="rounded bg-line px-1.5 py-0.5 text-[10px]">{notifs.length}</span>
          </h2>
          {loading ? (
            <div className="rounded-lg border border-line bg-panel px-4 py-6 text-center text-muted">
              Načítám…
            </div>
          ) : notifs.length === 0 ? (
            <div className="rounded-lg border border-line bg-panel py-2">
              <EmptyState title="Nic nehoří" hint="Můžeš si dát kávu." />
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
          <div className="relative flex-1 min-w-[200px]">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <IconSearch size={15} />
            </div>
            <input
              placeholder="Hledat v úkolech (titul, jméno, obsah)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-panel p-1 text-xs">
            {(["all", "mine", "delegated", "overdue"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1.5 transition ${
                  filter === f ? "bg-brand text-bg" : "text-muted hover:text-ink"
                }`}
              >
                {f === "all"
                  ? "Vše"
                  : f === "mine"
                  ? "Moje"
                  : f === "delegated"
                  ? "Čekám na"
                  : "Po termínu"}
              </button>
            ))}
          </div>
        </section>

        {/* Dvojí sloupec úkolů */}
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <IconInbox size={14} />
              Moje úkoly
              <span className="rounded bg-line px-1.5 py-0.5 text-[10px]">
                {tasksByDir.mine.length}
              </span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-line bg-panel">
              {tasksByDir.mine.length === 0 ? (
                <EmptyState title="Žádné otevřené úkoly pro Tebe" />
              ) : (
                tasksByDir.mine.map((t) => <TaskCard key={t.id} t={t} />)
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <IconSend size={14} />
              Čekám na ostatní
              <span className="rounded bg-line px-1.5 py-0.5 text-[10px]">
                {tasksByDir.delegated.length}
              </span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-line bg-panel">
              {tasksByDir.delegated.length === 0 ? (
                <EmptyState title="Žádné delegované úkoly" />
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
