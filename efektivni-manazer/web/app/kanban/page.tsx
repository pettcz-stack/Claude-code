"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { IconInbox, IconSend } from "@/components/Icon";
import { TaskCard } from "@/components/TaskCard";
import { api, Task } from "@/lib/api";
import { PHASE_LABEL, PHASE_STYLE } from "@/lib/ui";

const COLUMNS_DELEGATED = [
  "new",
  "awaiting_ack",
  "awaiting_eta",
  "in_progress",
  "awaiting_result",
  "done",
];
const COLUMNS_MINE = ["new", "acked", "in_progress", "blocked", "done"];

type View = "delegated" | "mine";

function Column({
  phase,
  tasks,
  onDragStart,
  onDrop,
  draggedOver,
  onDragEnter,
}: {
  phase: string;
  tasks: Task[];
  onDragStart: (e: React.DragEvent, t: Task) => void;
  onDrop: (e: React.DragEvent, phase: string) => void;
  draggedOver: string | null;
  onDragEnter: (phase: string) => void;
}) {
  const isOver = draggedOver === phase;
  const style = PHASE_STYLE[phase] || "";
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => onDragEnter(phase)}
      onDrop={(e) => onDrop(e, phase)}
      className={
        "flex min-h-[200px] flex-col rounded-xl border bg-panel transition " +
        (isOver ? "border-brand ring-2 ring-brand/40" : "border-line")
      }
    >
      <div className={`flex items-center justify-between border-b border-line px-3 py-2 ${style}`}>
        <div className="text-xs font-semibold uppercase tracking-wide">
          {PHASE_LABEL[phase] || phase}
        </div>
        <div className="rounded bg-bg/30 px-1.5 py-0.5 text-[10px] tabular-nums">
          {tasks.length}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {tasks.length === 0 && (
          <div className="grid h-20 place-items-center rounded-md border border-dashed border-line/60 text-xs text-muted/60">
            přetáhni úkol sem
          </div>
        )}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            t={t}
            draggable
            onDragStart={onDragStart}
            compact
          />
        ))}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [view, setView] = useState<View>("delegated");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const t = await api<Task[]>("/tasks?open_only=true");
      setTasks(t);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const cols = view === "delegated" ? COLUMNS_DELEGATED : COLUMNS_MINE;
  const tasksForView = tasks.filter((t) => t.direction === view);
  const byPhase: Record<string, Task[]> = {};
  cols.forEach((c) => (byPhase[c] = []));
  tasksForView.forEach((t) => {
    if (byPhase[t.phase]) byPhase[t.phase].push(t);
  });

  function onDragStart(e: React.DragEvent, t: Task) {
    setDraggedTask(t);
    e.dataTransfer.effectAllowed = "move";
  }
  async function onDrop(e: React.DragEvent, phase: string) {
    e.preventDefault();
    setDraggedOver(null);
    if (!draggedTask || draggedTask.phase === phase) {
      setDraggedTask(null);
      return;
    }
    // Optimistic update
    const previous = draggedTask;
    setTasks((cur) =>
      cur.map((t) => (t.id === previous.id ? { ...t, phase } : t))
    );
    setDraggedTask(null);
    try {
      await api<Task>(`/tasks/${previous.id}`, {
        method: "PATCH",
        body: JSON.stringify({ phase }),
      });
    } catch (e: any) {
      // Rollback
      setTasks((cur) =>
        cur.map((t) => (t.id === previous.id ? { ...t, phase: previous.phase } : t))
      );
      setErr(e.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
            <p className="text-sm text-muted">
              Přetáhni úkol mezi sloupci a změň jeho fázi.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-panel p-1">
            <button
              onClick={() => setView("delegated")}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition ${
                view === "delegated" ? "bg-brand text-bg" : "text-muted hover:text-ink"
              }`}
            >
              <IconSend size={14} />
              Čekám na ostatní
            </button>
            <button
              onClick={() => setView("mine")}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition ${
                view === "mine" ? "bg-brand text-bg" : "text-muted hover:text-ink"
              }`}
            >
              <IconInbox size={14} />
              Moje úkoly
            </button>
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        {loading ? (
          <p className="text-muted">Načítám…</p>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(220px, 1fr))` }}
          >
            {cols.map((phase) => (
              <Column
                key={phase}
                phase={phase}
                tasks={byPhase[phase] || []}
                onDragStart={onDragStart}
                onDrop={onDrop}
                draggedOver={draggedOver}
                onDragEnter={setDraggedOver}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
