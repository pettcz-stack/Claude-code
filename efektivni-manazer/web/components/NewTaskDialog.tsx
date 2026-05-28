"use client";

import { useState } from "react";
import { api, Task, TaskCreate } from "@/lib/api";

export function NewTaskDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: Task) => void;
}) {
  const [direction, setDirection] = useState<"delegated" | "mine">("delegated");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [counterpartName, setCounterpartName] = useState("");
  const [counterpartEmail, setCounterpartEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const payload: TaskCreate = {
        direction,
        title,
        summary,
        counterpart_email: counterpartEmail,
        counterpart_name: counterpartName,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        phase: direction === "delegated" ? "awaiting_ack" : "new",
      };
      const task = await api<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(task);
      onClose();
      setTitle(""); setSummary(""); setCounterpartName(""); setCounterpartEmail(""); setDeadline("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-xl border border-line bg-panel p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nový úkol</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("delegated")}
              className={`flex-1 rounded border px-3 py-2 text-sm ${
                direction === "delegated"
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted"
              }`}
            >
              Delegoval/a jsem (čekám na někoho)
            </button>
            <button
              type="button"
              onClick={() => setDirection("mine")}
              className={`flex-1 rounded border px-3 py-2 text-sm ${
                direction === "mine"
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted"
              }`}
            >
              Můj úkol (musím udělat já)
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">Co je úkol</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="např. Připravit nabídku pro klienta XYZ"
              className="w-full rounded border border-line bg-bg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">
                {direction === "delegated" ? "Komu zadáno" : "Od koho úkol"}
              </label>
              <input
                value={counterpartName}
                onChange={(e) => setCounterpartName(e.target.value)}
                placeholder="Jméno"
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Email</label>
              <input
                type="email"
                value={counterpartEmail}
                onChange={(e) => setCounterpartEmail(e.target.value)}
                placeholder="email@…"
                className="w-full rounded border border-line bg-bg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">Deadline (volitelné)</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded border border-line bg-bg px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted">Poznámka / kontext</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full rounded border border-line bg-bg px-3 py-2"
            />
          </div>

          {err && <p className="text-sm text-rose-300">{err}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-line px-4 py-2 text-sm"
          >
            Zrušit
          </button>
          <button
            disabled={saving || !title}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Vytvořit úkol"}
          </button>
        </div>
      </form>
    </div>
  );
}
