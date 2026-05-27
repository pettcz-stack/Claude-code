import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, type AlertItem } from './api.js';
import { minutesToHm } from './util.js';
import { useT } from './i18n/index.js';

export function AlertsView({ from, to, department, onOpenUser }: { from: string; to: string; department?: string; onOpenUser: (id: string) => void }) {
  const { t } = useT();
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  useEffect(() => { api.alerts(from, to, department).then(setAlerts).catch(() => setAlerts([])); }, [from, to, department]);

  const labelFor = (type: string): string => {
    const map: Record<string, string> = {
      MOUSE_JIGGLER: t('alerts.labelMouseJiggler'),
      KEYBOARD_WEIGHT: t('alerts.labelKeyboardWeight'),
      NO_APP_SWITCH: t('alerts.labelNoAppSwitch'),
      ROBOTIC_REGULARITY: t('alerts.labelRoboticRegularity'),
      PIRATED_SOFTWARE: t('alerts.labelPiratedSoftware'),
      AFTER_HOURS_ACTIVITY: t('alerts.labelAfterHours'),
    };
    return map[type] ?? type;
  };

  if (alerts && alerts.length === 0) {
    return (
      <div className="card flex items-center gap-3 p-6">
        <ShieldCheck className="text-emerald-500" size={24} />
        <div>
          <div className="font-semibold">{t('alerts.noAlertsTitle')}</div>
          <div className="text-sm muted-2">{t('alerts.noAlertsDesc')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm muted">
        <ShieldAlert size={16} className="text-red-500" />
        {t('alerts.suspectIntro')}
      </div>
      {(alerts ?? []).map((a) => (
        <div key={a.userId} className="card p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1">
              <button onClick={() => onOpenUser(a.userId)} className="text-left text-base font-semibold hover:underline">{a.displayName}</button>
              <div className="text-xs muted-2">{a.department}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-500">{a.riskScore}</div>
              <div className="text-xs muted-2">{t('alerts.riskOf100')}</div>
            </div>
          </div>
          <div className="space-y-2">
            {a.flags.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
                <span className={`chip ${f.severity === 'high' ? 'chip-nonwork' : 'chip-neutral'}`}>{f.severity === 'high' ? t('alerts.severityHigh') : t('alerts.severityMedium')}</span>
                <div>
                  <div className="text-sm font-medium">{labelFor(f.type)}</div>
                  <div className="text-xs muted">{f.detail}</div>
                  <div className="mt-0.5 text-xs muted-2">{t('alerts.affectedApprox', { time: minutesToHm(f.affectedMinutes) })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!alerts && <p className="muted-2">{t('alerts.loading')}</p>}
    </div>
  );
}
