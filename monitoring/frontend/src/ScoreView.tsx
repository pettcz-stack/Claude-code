import { useEffect, useState } from 'react';
import { Keyboard, Clock, AlertTriangle, AppWindow, Monitor, Shuffle } from 'lucide-react';
import { api, type UserScore, type User } from './api.js';
import { Donut } from './Donut.js';
import { ScoreScaleLegend } from './Legend.js';
import { AppIcon, appName } from './appMeta.js';
import { minutesToHm, chipClass, typeLabel, TYPE_COLORS, scoreColor } from './util.js';

function Card({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide muted-2">{icon} {title}</div>
      <div className={`text-lg font-semibold ${accent ?? ''}`}>{children}</div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="text-sm muted">{label}</span>
      <span className="ml-auto text-sm font-semibold">{value}</span>
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
    api.score(user.id, from, to).then(setS).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [user.id, from, to]);

  if (loading) return <p className="muted-2">Načítám…</p>;
  if (error) return <p className="text-red-500">Chyba: {error}</p>;
  if (!s) return null;

  const maxCat = Math.max(1, ...s.categories.map((c) => c.minutes));

  return (
    <div className="space-y-4">
      <ScoreScaleLegend />
      <div className="grid gap-6 card p-6 md:grid-cols-2">
        <div className="flex items-center justify-center">
          <Donut
            size={220}
            segments={[
              { value: s.workPct, color: TYPE_COLORS.work },
              { value: s.nonWorkPct, color: TYPE_COLORS.nonwork },
              { value: s.idlePct, color: TYPE_COLORS.idle },
              { value: s.pcOffPct, color: TYPE_COLORS.off },
            ]}
            center={<>
              <div className="text-5xl font-bold" style={{ color: scoreColor(s.score) }}>{s.score}%</div>
              <div className="text-xs muted-2">odpracováno z fondu</div>
              {s.monitorAdjusted && (
                <div className="mt-1 text-[10px] font-medium text-sky-500">upraveno o monitory (surové {s.scoreRaw}%)</div>
              )}
            </>}
          />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Legend color={TYPE_COLORS.work} label="Pracoval" value={`${s.workPct}% · ${minutesToHm(s.workMinutes)}`} />
          <Legend color={TYPE_COLORS.nonwork} label="Mimopracovní aktivity" value={`${s.nonWorkPct}% · ${minutesToHm(s.nonWorkMinutes)}`} />
          <Legend color={TYPE_COLORS.idle} label="U PC, ale nečinný" value={`${s.idlePct}% · ${minutesToHm(s.idleOnMinutes)}`} />
          <Legend color={TYPE_COLORS.off} label="Mimo PC (měl pracovat)" value={`${s.pcOffPct}% · ${minutesToHm(s.pcOffMinutes)}`} />
          <p className="mt-1 text-xs muted-2">Z času mimo PC bylo odhadem ~{minutesToHm(s.meetingMinutes)} na poradách (demo – nahradí napojení Outlooku).</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Tempo psaní" icon={<Keyboard size={13} />}>
          {s.avgKpm} <span className="text-sm font-normal muted">úhozů/min</span>
          <div className="mt-1 text-xs font-normal text-emerald-500">píše rychleji než {s.kpmPercentile} % firmy {s.kpmPercentile >= 50 ? '🎉' : ''}</div>
        </Card>
        <Card title="Aktivní práce" icon={<Clock size={13} />} accent="text-emerald-500">{minutesToHm(s.workMinutes)}</Card>
        <Card title="Mimopracovní" icon={<AlertTriangle size={13} />} accent="text-red-500">{minutesToHm(s.nonWorkMinutes)}</Card>
        <Card title="Nejčastější aplikace" icon={<AppWindow size={13} />}>
          {s.topApp
            ? <span className="flex items-center gap-2"><AppIcon app={s.topApp} size={16} /> {appName(s.topApp)}</span>
            : '—'}
        </Card>
        <Card title="Monitory" icon={<Monitor size={13} />}>
          {s.monitorTypical ? `${s.monitorTypical} ` : '— '}<span className="text-sm font-normal muted">{s.monitorTypical === 1 ? 'obrazovka' : s.monitorTypical >= 2 && s.monitorTypical <= 4 ? 'obrazovky' : 'obrazovek'}</span>
          <div className="mt-1 text-xs font-normal muted-2">{s.multiMonitorPct} % času na 2+ obrazovkách</div>
        </Card>
        <Card title="Fragmentace pozornosti" icon={<Shuffle size={13} />}>
          {s.appSwitchesPerHour} <span className="text-sm font-normal muted">přepnutí/h</span>
          <div className="mt-1 text-xs font-normal muted-2">nižší = soustředěnější práce</div>
        </Card>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">V čem trávil čas (kategorie)</h3>
        <div className="space-y-2">
          {s.categories.map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <div className="flex w-44 shrink-0 items-center gap-2 text-sm">
                <span className="truncate">{c.category}</span>
                <span className={chipClass(c.type)}>{typeLabel(c.type)}</span>
              </div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                <div className="h-full rounded-full" style={{ width: `${(c.minutes / maxCat) * 100}%`, background: c.type === 'NON_WORK' ? TYPE_COLORS.nonwork : c.type === 'WORK' ? TYPE_COLORS.work : TYPE_COLORS.idle }} />
              </div>
              <div className="w-20 text-right text-sm tabular-nums muted">{minutesToHm(c.minutes)}</div>
            </div>
          ))}
          {s.categories.length === 0 && <p className="text-sm muted-2">Žádná data za období.</p>}
        </div>
      </div>
    </div>
  );
}
