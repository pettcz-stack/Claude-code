import { Inbox, Download, AlertCircle, Calendar } from 'lucide-react';
import { useT } from './i18n/index.js';

/**
 * Sjednocené prázdné stavy s konkrétními akcemi. Místo bezbarvého "Žádná data"
 * ukazujeme proč a co s tím – snižuje frustraci a urychluje onboarding.
 *
 * Varianty:
 *  - `noDevices`: žádný agent ještě nehlásí → stáhnout pkg/msi
 *  - `noRange`:   zvolené období nemá data → upravit filter
 *  - `noResult`:  search/filter neodpovídá → reset filtru
 *  - `noDataYet`: zařízení tu je, ale ještě nedoběhly intervaly (< 2 min od enrollmentu)
 *  - `error`:     API selhalo → ukázat detail + retry tlačítko
 */
type Variant = 'noDevices' | 'noRange' | 'noResult' | 'noDataYet' | 'error';

export function EmptyState({ variant, message, action }: {
  variant: Variant;
  message?: string;
  action?: React.ReactNode;
}) {
  const { t } = useT();
  const config = {
    noDevices: {
      icon: <Download size={28} className="text-emerald-500" />,
      title: t('empty.noDevices.title'),
      body: t('empty.noDevices.body'),
      cta: (
        <a href="https://github.com/pettcz-stack/claude-code/releases/tag/agent-latest" target="_blank" rel="noreferrer" className="btn-primary">
          <Download size={14} /> {t('empty.noDevices.downloadAgent')}
        </a>
      ),
    },
    noRange: {
      icon: <Calendar size={28} className="text-blue-500" />,
      title: t('empty.noRange.title'),
      body: t('empty.noRange.body'),
      cta: null,
    },
    noResult: {
      icon: <Inbox size={28} className="text-amber-500" />,
      title: t('empty.noResult.title'),
      body: t('empty.noResult.body'),
      cta: null,
    },
    noDataYet: {
      icon: <Calendar size={28} className="text-blue-400 animate-pulse" />,
      title: t('empty.noDataYet.title'),
      body: t('empty.noDataYet.body'),
      cta: null,
    },
    error: {
      icon: <AlertCircle size={28} className="text-red-500" />,
      title: t('empty.error.title'),
      body: message ?? '',
      cta: null,
    },
  }[variant];

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-6 py-12 text-center dark:border-slate-700">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 dark:bg-slate-800">
        {config.icon}
      </div>
      <div className="text-base font-semibold">{config.title}</div>
      <p className="max-w-md text-sm muted-2">{config.body}</p>
      {action ?? config.cta}
    </div>
  );
}
