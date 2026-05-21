import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export type Command = { id: string; label: string; hint?: string; onSelect: () => void };

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? commands.filter((c) => c.label.toLowerCase().includes(s) || (c.hint ?? '').toLowerCase().includes(s)) : commands;
    return list.slice(0, 50);
  }, [q, commands]);

  useEffect(() => { if (idx >= filtered.length) setIdx(0); }, [filtered, idx]);

  if (!open) return null;

  function run(c?: Command) {
    if (!c) return;
    c.onSelect();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={onClose}>
      <div className="card w-full max-w-xl overflow-hidden p-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-slate-700">
          <Search size={16} className="muted-2" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(filtered[idx]); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Hledat stránku nebo zaměstnance…"
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
          <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] muted-2 dark:border-slate-600">Esc</span>
        </div>
        <div className="max-h-80 overflow-auto py-2">
          {filtered.length === 0 && <div className="px-4 py-6 text-center text-sm muted-2">Nic nenalezeno.</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(c)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${i === idx ? 'bg-emerald-50 dark:bg-emerald-500/15' : ''}`}
            >
              <span>{c.label}</span>
              <span className="flex items-center gap-2">
                {c.hint && <span className="text-xs muted-2">{c.hint}</span>}
                {i === idx && <CornerDownLeft size={13} className="muted-2" />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
