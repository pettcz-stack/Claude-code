import { useEffect, useState } from 'react';
import { AppWindow, Globe } from 'lucide-react';
import { api, type ActivityItem } from './api.js';
import { chipClass, typeLabel, minutesToHm, TYPE_COLORS } from './util.js';

function barColor(type: string) {
  return type === 'NON_WORK' ? TYPE_COLORS.nonwork : type === 'WORK' ? TYPE_COLORS.work : TYPE_COLORS.idle;
}

function List({ title, icon, items }: { title: string; icon: React.ReactNode; items: ActivityItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.minutes));
  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon} {title}</h3>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3">
            <div className="w-44 shrink-0 truncate text-sm" title={it.label}>{it.label}</div>
            <span className={chipClass(it.type)}>{typeLabel(it.type)}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <div className="h-full rounded-full" style={{ width: `${(it.minutes / max) * 100}%`, background: barColor(it.type) }} />
            </div>
            <div className="w-20 text-right text-sm tabular-nums muted">{minutesToHm(it.minutes)}</div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm muted-2">Žádná data.</p>}
      </div>
    </div>
  );
}

export function TopActivities({ from, to, userId, department }: { from: string; to: string; userId?: string; department?: string }) {
  const [apps, setApps] = useState<ActivityItem[]>([]);
  const [sites, setSites] = useState<ActivityItem[]>([]);

  useEffect(() => {
    api.topActivities(from, to, { userId, department }).then((r) => { setApps(r.apps); setSites(r.sites); }).catch(() => undefined);
  }, [from, to, userId, department]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <List title="Top aplikace" icon={<AppWindow size={16} className="text-emerald-600" />} items={apps} />
      <List title="Top weby (z titulků oken)" icon={<Globe size={16} className="text-emerald-600" />} items={sites} />
    </div>
  );
}
