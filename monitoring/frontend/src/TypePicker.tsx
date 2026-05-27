import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { chipClass, typeLabel } from './util.js';
import { useT } from './i18n/index.js';

const TYPES = ['WORK', 'NON_WORK', 'NEUTRAL', 'UNKNOWN'];

/**
 * Klikabilní chip s typem klasifikace. Klik → inline `<select>` →
 * `onSave(newType)` po výběru. Když `canEdit=false`, renderuje se jen statický
 * chip (bez šipky, bez kurzoru).
 *
 * Použití:
 *  - CategoryAdmin (Klasifikace) – editace existujících kategorií / web pravidel.
 *  - TopActivities (Přehled) – inline reklasifikace nejpoužívanějších aplikací
 *    a webů přímo z dashboardu.
 */
export function TypePicker({ value, onSave, canEdit }: {
  value: string;
  onSave: (newType: string) => Promise<void> | void;
  canEdit: boolean;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  if (!canEdit) return <span className={chipClass(value)}>{typeLabel(value)}</span>;
  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title={t('categoryAdmin.clickToReclassify')}
        className={`${chipClass(value)} inline-flex items-center gap-0.5 cursor-pointer hover:opacity-80`}
      >
        {typeLabel(value)}<ChevronDown size={11} className="opacity-60" />
      </button>
    );
  }
  return (
    <select
      autoFocus
      value={value}
      onBlur={() => setEditing(false)}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const newType = e.target.value;
        setEditing(false);
        if (newType !== value) await onSave(newType);
      }}
      className="field h-7 py-0 text-xs"
    >
      {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
    </select>
  );
}
