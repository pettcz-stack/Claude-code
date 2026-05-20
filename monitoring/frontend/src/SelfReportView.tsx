import { useEffect, useState } from 'react';
import { ShieldCheck, X, Keyboard, Trophy, Users, Building2, Sparkles } from 'lucide-react';
import { api, type SelfReportData, type User } from './api.js';

function Compare({ icon, label, pct, color }: { icon: React.ReactNode; label: string; pct: number; color: string }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm">{icon} {label}</div>
      <div className="mb-1 flex items-end justify-between">
        <span className="text-3xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-xs muted-2">lepší/rychlejší než tolik kolegů</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function SelfReportView({ user, from, to }: { user: User; from: string; to: string }) {
  const [r, setR] = useState<SelfReportData | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(true);
  useEffect(() => { api.selfReport(user.id, from, to).then(setR).catch(() => setR(null)); }, [user.id, from, to]);
  if (!r) return <p className="muted-2">Načítám…</p>;

  const grade = r.score >= 70 ? { t: 'Skvělá práce!', e: '🏆' } : r.score >= 45 ? { t: 'Dobrá práce', e: '👍' } : { t: 'Je co zlepšovat', e: '💪' };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">Tvůj report práce</div>
            <div className="text-2xl font-bold">{r.displayName}</div>
            <div className="text-sm opacity-90">{r.department}</div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-extrabold">{r.score}%</div>
            <div className="text-sm opacity-90">{grade.e} {grade.t}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Compare icon={<Users size={15} className="text-emerald-600" />} label="Ve firmě" pct={r.companyPercentile} color="#10b981" />
        <Compare icon={<Building2 size={15} className="text-emerald-600" />} label="Na oddělení" pct={r.deptPercentile} color="#0ea5e9" />
        <Compare icon={<Keyboard size={15} className="text-emerald-600" />} label="Rychlost psaní" pct={r.kpmPercentile} color="#8b5cf6" />
      </div>

      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-emerald-500" /> Tvoje čísla za období</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Skóre efektivity" value={`${r.score}%`} />
          <Stat label="Aktivní práce" value={`${r.activeHours} h`} />
          <Stat label="Tempo psaní" value={`${r.avgKpm}/min`} />
          <Stat label="Monitory" value={`${r.monitorTypical || '—'}`} />
        </div>
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Trophy size={16} /> V psaní na klávesnici jsi rychlejší než <b>{r.kpmPercentile} %</b> zaměstnanců a celkově lepší než <b>{r.companyPercentile} %</b> firmy. Skvělé!
        </p>
      </div>

      {/* Ujištění o soukromí – odebíratelné */}
      {showPrivacy && (
        <div className="card relative border-emerald-300 p-5 dark:border-emerald-500/40">
          <button onClick={() => setShowPrivacy(false)} className="absolute right-3 top-3 muted-2 hover:text-gray-600" title="Skrýt"><X size={16} /></button>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck size={18} /> Tvé soukromí je v bezpečí</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm muted">
            <li><b>Nečteme, co píšeš</b> – sledujeme jen tempo (počet úhozů), ne text.</li>
            <li><b>Nečteme soukromé konverzace</b>, e-maily ani zprávy.</li>
            <li><b>Žádné screenshoty</b>, žádný mikrofon, žádná kamera.</li>
            <li>Vidíme jen <b>souhrnnou aktivitu</b> a v jaké aplikaci pracuješ – kvůli férovému hodnocení práce.</li>
          </ul>
          <p className="mt-2 text-xs muted-2">Toto ujištění je volitelné a lze ho v reportu vypnout.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide muted-2">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
