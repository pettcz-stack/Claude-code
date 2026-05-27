import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { api, type IntegrityResult } from './api.js';
import { minutesToHm } from './util.js';
import { useT } from './i18n/index.js';

export function IntegrityPanel({ userId, from, to }: { userId: string; from: string; to: string }) {
  const { t } = useT();
  const [r, setR] = useState<IntegrityResult | null>(null);
  useEffect(() => { api.integrity(userId, from, to).then(setR).catch(() => setR(null)); }, [userId, from, to]);

  const labelFor = (type: string): string => {
    const map: Record<string, string> = {
      MOUSE_JIGGLER: t('integrity.labelMouseJiggler'),
      KEYBOARD_WEIGHT: t('integrity.labelKeyboardWeight'),
      NO_APP_SWITCH: t('integrity.labelNoAppSwitch'),
      ROBOTIC_REGULARITY: t('integrity.labelRoboticRegularity'),
      PIRATED_SOFTWARE: t('integrity.labelPiratedSoftware'),
      AFTER_HOURS_ACTIVITY: t('integrity.labelAfterHours'),
    };
    return map[type] ?? type;
  };

  if (!r) return null;

  if (r.flags.length === 0) {
    return (
      <div className="card flex items-center gap-3 p-4">
        <ShieldCheck className="text-emerald-500" size={22} />
        <div>
          <div className="text-sm font-semibold">{t('integrity.okTitle')}</div>
          <div className="text-xs muted-2">{t('integrity.okDesc')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-red-300 p-5 dark:border-red-500/40">
      <div className="mb-3 flex items-center gap-3">
        <ShieldAlert className="text-red-500" size={22} />
        <div>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
            {t('integrity.suspectTitle', { score: r.riskScore })}
          </div>
          <div className="text-xs muted-2">{t('integrity.suspectDesc')}</div>
        </div>
      </div>
      <div className="space-y-2">
        {r.flags.map((f, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
            <span className={`chip ${f.severity === 'high' ? 'chip-nonwork' : 'chip-neutral'}`}>{f.severity === 'high' ? t('integrity.severityHigh') : t('integrity.severityMedium')}</span>
            <div>
              <div className="text-sm font-medium">{labelFor(f.type)}</div>
              <div className="text-xs muted">{f.detail}</div>
              <div className="mt-0.5 text-xs muted-2">{t('integrity.affectedApprox', { time: minutesToHm(f.affectedMinutes) })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
