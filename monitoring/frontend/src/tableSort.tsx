import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * Sdílené utility pro řazení tabulek.
 *
 * Použití:
 *   const { sorted, key, dir, setSort } = useSort(rows, 'activeMinutes', 'desc');
 *   <SortHeader sortKey="activeMinutes" current={key} dir={dir} onChange={setSort}>Aktivní</SortHeader>
 *   {sorted.map(...)}
 *
 * Stringové sloupce řadí localeCompare. Číselné a date podle Number/Date.
 * Null/undefined se vždy řadí na konec (asc i desc).
 */
export type SortDir = 'asc' | 'desc';

export function useSort<T extends Record<string, unknown>>(
  rows: T[],
  defaultKey: keyof T & string,
  defaultDir: SortDir = 'desc',
) {
  const [key, setKey] = useState<(keyof T & string)>(defaultKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);

  const setSort = (newKey: keyof T & string) => {
    if (newKey === key) {
      setDir(dir === 'asc' ? 'desc' : 'asc');
    } else {
      setKey(newKey);
      // První klik na nový sloupec: text → asc (A→Z), čísla → desc (nejvyšší první)
      const sample = rows.find((r) => r[newKey] != null)?.[newKey];
      setDir(typeof sample === 'number' ? 'desc' : 'asc');
    }
  };

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => cmp(a[key], b[key], dir));
    return arr;
  }, [rows, key, dir]);

  return { sorted, key, dir, setSort };
}

function cmp(a: unknown, b: unknown, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // null vždy na konec
  if (b == null) return -1;
  const mul = dir === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (Number(a) - Number(b)) * mul;
  // Datum (ISO string nebo Date)
  if (a instanceof Date && b instanceof Date) return (a.getTime() - b.getTime()) * mul;
  // String – localeCompare bere v potaz unicode (Š, Č, atd.)
  return String(a).localeCompare(String(b), 'cs', { numeric: true, sensitivity: 'base' }) * mul;
}

/** Klikabilní záhlaví sloupce s šipkou. Použij místo <th>. */
export function SortHeader<K extends string>({
  sortKey, current, dir, onChange, children, align = 'left', className = '',
}: {
  sortKey: K;
  current: string;
  dir: SortDir;
  onChange: (k: K) => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const isActive = current === sortKey;
  const Arrow = !isActive ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className={`th cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/60 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`} onClick={() => onChange(sortKey)}>
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        <Arrow size={13} className={isActive ? 'text-emerald-500' : 'opacity-40'} />
      </span>
    </th>
  );
}
