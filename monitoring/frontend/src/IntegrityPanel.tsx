import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { api, type IntegrityResult } from './api.js';
import { minutesToHm } from './util.js';

const LABELS: Record<string, string> = {
  MOUSE_JIGGLER: 'Simulátor myši',
  KEYBOARD_WEIGHT: 'Předmět na klávesnici / simulátor kláves',
  NO_APP_SWITCH: 'Bez přepínání aplikací',
  ROBOTIC_REGULARITY: 'Roboticky pravidelný vzor',
};

export function IntegrityPanel({ userId, from, to }: { userId: string; from: string; to: string }) {
  const [r, setR] = useState<IntegrityResult | null>(null);
  useEffect(() => { api.integrity(userId, from, to).then(setR).catch(() => setR(null)); }, [userId, from, to]);
  if (!r) return null;

  if (r.flags.length === 0) {
    return (
      <div className="card flex items-center gap-3 p-4">
        <ShieldCheck className="text-emerald-500" size={22} />
        <div>
          <div className="text-sm font-semibold">Integrita aktivity v pořádku</div>
          <div className="text-xs muted-2">Nezjištěny žádné známky nepovolených praktik.</div>
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
            Podezření na nepovolené (pirátské) praktiky — riziko {r.riskScore}/100
          </div>
          <div className="text-xs muted-2">Vzorce vstupu naznačují obcházení monitoringu. Doporučeno prověřit.</div>
        </div>
      </div>
      <div className="space-y-2">
        {r.flags.map((f, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg bg-red-50 p-3 dark:bg-red-500/10">
            <span className={`chip ${f.severity === 'high' ? 'chip-nonwork' : 'chip-neutral'}`}>{f.severity === 'high' ? 'vysoké' : 'střední'}</span>
            <div>
              <div className="text-sm font-medium">{LABELS[f.type] ?? f.type}</div>
              <div className="text-xs muted">{f.detail}</div>
              <div className="mt-0.5 text-xs muted-2">Dotčeno přibližně {minutesToHm(f.affectedMinutes)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
