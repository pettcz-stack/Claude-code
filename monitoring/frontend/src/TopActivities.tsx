import { useEffect, useState } from 'react';
import { AppWindow, Globe } from 'lucide-react';
import { api, type ActivityItem } from './api.js';
import { chipClass, typeLabel, minutesToHm, TYPE_COLORS, isBrowser } from './util.js';
import { AppIcon, useAppName } from './appMeta.js';
import { useT } from './i18n/index.js';
import { TypePicker } from './TypePicker.js';
import { useToast } from './Toast.js';

function barColor(type: string) {
  return type === 'NON_WORK' ? TYPE_COLORS.nonwork : type === 'WORK' ? TYPE_COLORS.work : TYPE_COLORS.idle;
}

function List({ title, icon, items, kind, editable, onReclassified }: {
  title: string;
  icon: React.ReactNode;
  items: ActivityItem[];
  kind: 'app' | 'site';
  editable: boolean;
  onReclassified: () => void;
}) {
  const { t } = useT();
  const appName = useAppName();
  const toast = useToast();
  const max = Math.max(1, ...items.map((i) => i.minutes));

  async function reclassify(it: ActivityItem, newType: string) {
    try {
      if (kind === 'app') {
        await api.saveCategory({ appName: it.label, category: it.category || 'Ostatní', type: newType });
      } else {
        await api.saveWebRule({ keyword: it.label, category: it.category || 'Ostatní', type: newType });
      }
      toast(t('categoryAdmin.saved', { name: it.label, type: typeLabel(newType) }));
      onReclassified();
    } catch (err) {
      toast(`${t('common.error')}: ${err instanceof Error ? err.message : ''}`, 'error');
    }
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon} {title}</h3>
      <div className="space-y-2">
        {items.map((it) => {
          // Prohlížeč jako app nelze klasifikovat jednoznačně – řídí se podle webů.
          const browserApp = kind === 'app' && isBrowser(it.label);
          const showPicker = editable && !browserApp;
          return (
            <div key={it.label} className="flex items-center gap-3">
              {kind === 'app'
                ? <AppIcon app={it.label} size={16} />
                : <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-sky-500/10"><Globe size={16} className="text-sky-500" /></span>}
              <div className="w-40 shrink-0 truncate text-sm" title={it.label}>{kind === 'app' ? appName(it.label) : it.label}</div>
              {showPicker
                ? <TypePicker value={it.type} canEdit={true} onSave={(nt) => reclassify(it, nt)} />
                : browserApp
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs muted dark:bg-sky-500/10" title={t('categoryAdmin.browserTypeTooltip')}><Globe size={11} /> {t('categoryAdmin.browserByWeb')}</span>
                  : <span className={chipClass(it.type)}>{typeLabel(it.type)}</span>}
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                <div className="h-full rounded-full" style={{ width: `${(it.minutes / max) * 100}%`, background: barColor(it.type) }} />
              </div>
              <div className="w-20 text-right text-sm tabular-nums muted">{minutesToHm(it.minutes)}</div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-sm muted-2">{t('topActivities.empty')}</p>}
      </div>
    </div>
  );
}

export function TopActivities({ from, to, userId, department, editable = false }: {
  from: string;
  to: string;
  userId?: string;
  department?: string;
  /**
   * Když true (typicky v záložce Klasifikace), zobrazí TypePicker u apps/webs
   * pro inline reklasifikaci. Jinde (Přehled, Trend, Detail uživatele) zůstává
   * jen statický chip, aby se nemíchaly admin akce do běžných pohledů.
   */
  editable?: boolean;
}) {
  const { t } = useT();
  const [apps, setApps] = useState<ActivityItem[]>([]);
  const [sites, setSites] = useState<ActivityItem[]>([]);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    api.topActivities(from, to, { userId, department })
      .then((r) => { setApps(r.apps); setSites(r.sites); })
      .catch(() => undefined);
  }, [from, to, userId, department, reloadCount]);

  const reload = () => setReloadCount((n) => n + 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <List title={t('topActivities.appsTitle')} icon={<AppWindow size={16} className="text-emerald-600" />} items={apps} kind="app" editable={editable} onReclassified={reload} />
      <List title={t('topActivities.sitesTitle')} icon={<Globe size={16} className="text-emerald-600" />} items={sites} kind="site" editable={editable} onReclassified={reload} />
    </div>
  );
}
