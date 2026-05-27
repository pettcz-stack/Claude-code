import { Info } from 'lucide-react';
import { useDevMode } from './devMode.js';

/**
 * Malá ⓘ ikonka u metriky, která po hoveru ukáže tooltip s metodikou
 * výpočtu. Zobrazuje se POUZE když je zapnutý Developer Mode (admin
 * toggle v UserMenu). Pro běžné uživatele neviditelná.
 *
 * Použití:
 *   <h3>Průměrné skóre <MetricInfo text="..." /></h3>
 */
export function MetricInfo({ text, position = 'right' }: { text: string; position?: 'right' | 'left' }) {
  const { devMode } = useDevMode();
  if (!devMode) return null;
  return (
    <span className="group relative inline-flex">
      <Info
        size={13}
        className="ml-1 inline-block cursor-help text-blue-500 opacity-80 hover:opacity-100"
      />
      <span
        className={`pointer-events-none absolute z-50 hidden w-72 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-xl group-hover:block ${position === 'left' ? 'right-0' : 'left-0'} top-5`}
        style={{ whiteSpace: 'normal' }}
      >
        {text}
      </span>
    </span>
  );
}
