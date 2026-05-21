import { Inbox } from 'lucide-react';

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 muted-2 dark:bg-slate-700">
        {icon ?? <Inbox size={22} />}
      </div>
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="max-w-xs text-xs muted-2">{hint}</div>}
    </div>
  );
}
