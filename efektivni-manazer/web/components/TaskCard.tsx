import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PhaseBadge } from "@/components/PhaseBadge";
import { IconClock, IconFlame } from "@/components/Icon";
import { Task } from "@/lib/api";
import { deadlineLabel, formatRelative, PRIORITY_DOT } from "@/lib/ui";

export function TaskCard({
  t,
  draggable = false,
  onDragStart,
  compact = false,
}: {
  t: Task;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, t: Task) => void;
  compact?: boolean;
}) {
  const dl = deadlineLabel(t.deadline);
  const isOverdue = !!(t.deadline && new Date(t.deadline).getTime() < Date.now());
  const tags = t.manual_overrides?.tags || [];
  const priority = t.manual_overrides?.priority;

  return (
    <Link
      href={`/tasks/${t.id}`}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, t)}
      className={
        "group relative flex items-start gap-3 transition " +
        (compact
          ? "rounded-md border border-line bg-bg/50 px-3 py-2.5 hover:border-brand/40 hover:bg-line/40"
          : "border-b border-line px-4 py-3 hover:bg-line/40")
      }
    >
      {isOverdue && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-500/60" />
      )}
      <Avatar
        name={t.counterpart_name}
        email={t.counterpart_email}
        size={compact ? 28 : 36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {priority && (
            <span
              title={`Priorita P${priority}`}
              className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`}
            />
          )}
          <div className="min-w-0 truncate font-medium text-ink group-hover:text-brand">
            {t.title || "(bez nadpisu)"}
          </div>
          {!compact && <PhaseBadge phase={t.phase} />}
        </div>
        <div className={"mt-0.5 truncate text-xs text-muted " + (compact ? "" : "")}>
          {t.counterpart_name || t.counterpart_email || "—"}
          {!compact && t.summary && (
            <span> · {t.summary.slice(0, 100)}</span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="rounded bg-line px-1.5 py-0.5 text-[10px] text-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right text-xs">
        {dl && (
          <div className={`flex items-center justify-end gap-1 font-medium ${dl.style}`}>
            {isOverdue ? <IconFlame size={11} /> : <IconClock size={11} />}
            {dl.text}
          </div>
        )}
        {!compact && <div className="text-muted">{formatRelative(t.last_activity_at)}</div>}
      </div>
    </Link>
  );
}
