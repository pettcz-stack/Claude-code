import { useEffect, useState } from 'react';
import { api, type UserScore, type User } from './api.js';
import { Donut } from './Donut.js';
import { minutesToHm } from './util.js';

const C = {
  work: '#10b981', // zelená – práce
  nonwork: '#ef4444', // červená – mimopráce
  idle: '#cbd5e1', // světle šedá – nečinnost
  off: '#94a3b8', // šedá – mimo PC
};

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">{title}</div>
      <div className={`text-lg font-semibold ${accent ?? 'text-gray-800'}`}>{children}</div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="text-sm text-gray-600">{label}</span>
      <span className="ml-auto text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export function ScoreView({ user, from, to }: { user: User; from: string; to: string }) {
  const [s, setS] = useState<UserScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .score(user.id, from, to)
      .then(setS)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [user.id, from, to]);

  if (loading) return <p className="text-gray-400">Načítám…</p>;
  if (error) return <p className="text-red-600">Chyba: {error}</p>;
  if (!s) return null;

  const scoreColor = s.score >= 70 ? 'text-emerald-600' : s.score >= 45 ? 'text-amber-500' : 'text-red-500';
  const maxCat = Math.max(1, ...s.categories.map((c) => c.minutes));

  return (
    <div className="space-y-6">
      {/* Hlavní karta: donut + segmenty */}
      <div className="grid gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div className="flex items-center justify-center">
          <Donut
            size={220}
            segments={[
              { value: s.workPct, color: C.work },
              { value: s.nonWorkPct, color: C.nonwork },
              { value: s.idlePct, color: C.idle },
              { value: s.pcOffPct, color: C.off },
            ]}
            center={
              <>
                <div className={`text-5xl font-bold ${scoreColor}`}>{s.score}%</div>
                <div className="text-xs text-gray-400">odpracováno z fondu</div>
              </>
            }
          />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Legend color={C.work} label="🟢 Pracoval" value={`${s.workPct}% · ${minutesToHm(s.workMinutes)}`} />
          <Legend color={C.nonwork} label="🔴 Mimopracovní aktivity" value={`${s.nonWorkPct}% · ${minutesToHm(s.nonWorkMinutes)}`} />
          <Legend color={C.idle} label="⚪ U PC, ale nečinný" value={`${s.idlePct}% · ${minutesToHm(s.idleOnMinutes)}`} />
          <Legend color={C.off} label="⚫ Mimo PC (měl pracovat)" value={`${s.pcOffPct}% · ${minutesToHm(s.pcOffMinutes)}`} />
          <p className="mt-1 text-xs text-gray-400">
            Z času mimo PC bylo odhadem ~{minutesToHm(s.meetingMinutes)} na poradách (demo – nahradí napojení Outlooku).
          </p>
        </div>
      </div>

      {/* Demo ukazatele */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Tempo psaní" accent="text-gray-800">
          {s.avgKpm} úhozů/min
          <div className="mt-1 text-xs font-normal text-emerald-600">
            lepší než {s.kpmPercentile} % firmy {s.kpmPercentile >= 50 ? '🎉' : ''}
          </div>
        </Card>
        <Card title="Aktivní práce" accent="text-emerald-600">{minutesToHm(s.workMinutes)}</Card>
        <Card title="Mimopracovní" accent="text-red-500">{minutesToHm(s.nonWorkMinutes)}</Card>
        <Card title="Nejčastější aplikace">{s.topApp ?? '—'}</Card>
      </div>

      {/* Rozpad kategorií */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">V čem trávil čas (kategorie)</h3>
        <div className="space-y-2">
          {s.categories.map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-sm text-gray-600">
                {c.category}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                    c.type === 'NON_WORK'
                      ? 'bg-red-100 text-red-700'
                      : c.type === 'WORK'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c.type === 'NON_WORK' ? 'mimo' : c.type === 'WORK' ? 'práce' : 'neutrál'}
                </span>
              </div>
              <div className="h-3 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(c.minutes / maxCat) * 100}%`,
                    background: c.type === 'NON_WORK' ? C.nonwork : c.type === 'WORK' ? C.work : C.idle,
                  }}
                />
              </div>
              <div className="w-20 text-right text-sm tabular-nums text-gray-500">{minutesToHm(c.minutes)}</div>
            </div>
          ))}
          {s.categories.length === 0 && <p className="text-sm text-gray-400">Žádná data za období.</p>}
        </div>
      </div>
    </div>
  );
}
