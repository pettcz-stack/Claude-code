import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { newFeatureKeys, CURRENT_VERSION } from './releases.js';

/**
 * "NEW" badge u feature, kterou jsme přidali v aktuální verzi.
 * Zmizí automaticky, jakmile user otevře dashboard po update na další verzi
 * (markReleaseSeen() z banneru/menu uloží `focus_seen_version`).
 *
 * Použití:
 *   <h3>Tempo psaní <NewBadge feature="typingKpm" /></h3>
 *
 * Feature klíče definované v src/releases.ts → RELEASES[0].features.
 */
export function NewBadge({ feature, compact = false }: { feature: string; compact?: boolean }) {
  const isNew = useMemo(() => newFeatureKeys().has(feature), [feature]);
  if (!isNew) return null;
  return (
    <span
      title={`Novinka ve verzi ${CURRENT_VERSION}`}
      className={`ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${compact ? 'h-4' : ''}`}
    >
      <Sparkles size={9} className="opacity-90" />
      <span>NEW</span>
    </span>
  );
}
