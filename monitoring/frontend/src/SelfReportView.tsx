import { useEffect, useState } from 'react';
import { ShieldCheck, X, Keyboard, Trophy, Users, Building2, Sparkles, Award, Footprints, Flame, HeartPulse, PersonStanding, GlassWater, Eye, Coffee, Wind, Target, Armchair, Activity, Quote } from 'lucide-react';
import { api, type SelfReportData, type TipsData, type User } from './api.js';

// Ikona pro kategorii zdravotního tipu (tipy samotné přicházejí z DB).
const CAT_ICON: Record<string, React.ReactNode> = {
  stand: <PersonStanding size={16} className="text-rose-500" />,
  move: <Activity size={16} className="text-emerald-500" />,
  eyes: <Eye size={16} className="text-violet-500" />,
  breath: <Wind size={16} className="text-sky-500" />,
  air: <Wind size={16} className="text-cyan-500" />,
  water: <GlassWater size={16} className="text-sky-500" />,
  coffee: <Coffee size={16} className="text-amber-700" />,
  ergo: <Armchair size={16} className="text-teal-500" />,
  focus: <Target size={16} className="text-indigo-500" />,
  mood: <HeartPulse size={16} className="text-rose-500" />,
};
function catIcon(cat: string | null): React.ReactNode {
  return (cat && CAT_ICON[cat]) || <HeartPulse size={16} className="text-rose-500" />;
}

const HOUR = () => Math.floor(Date.now() / 3600000);
const DAY = () => Math.floor(Date.now() / 86400000);
/** Vybere prvek dle počítadla období (deterministicky, mění se v čase). */
function rotate<T>(arr: T[], counter: number): T | undefined {
  return arr.length ? arr[counter % arr.length] : undefined;
}

// Sada odznaků pro zábavný režim – hravé ocenění různých stránek práce.
type Badge = { emoji: string; name: string; desc: string; earned: (r: SelfReportData) => boolean };
const BADGES: Badge[] = [
  { emoji: '🚀', name: 'Stroj na výkon', desc: 'Skóre 90 % a více', earned: (r) => r.score >= 90 },
  { emoji: '⭐', name: 'Tahoun týmu', desc: 'Skóre 75–89 %', earned: (r) => r.score >= 75 && r.score < 90 },
  { emoji: '🏆', name: 'Šampion firmy', desc: 'Efektivnější než 90 % firmy', earned: (r) => r.companyPercentile >= 90 },
  { emoji: '🥇', name: 'Hvězda oddělení', desc: 'Mezi nej v oddělení (90 %+)', earned: (r) => r.deptPercentile >= 90 },
  { emoji: '🏎️', name: 'Rychloprsťák', desc: 'Píše rychleji než 80 % firmy', earned: (r) => r.kpmPercentile >= 80 },
  { emoji: '⌨️', name: 'Klávesový mág', desc: 'Tempo 200+ úhozů/min', earned: (r) => r.avgKpm >= 200 },
  { emoji: '🎯', name: 'Soustředěný', desc: 'Málo přepínání oken (≤ 8/h)', earned: (r) => r.appSwitchesPerHour > 0 && r.appSwitchesPerHour <= 8 },
  { emoji: '🧘', name: 'Mistr fokusu', desc: 'Minimum rozptýlení (≤ 5/h)', earned: (r) => r.appSwitchesPerHour > 0 && r.appSwitchesPerHour <= 5 },
  { emoji: '💎', name: 'Bez rozptýlení', desc: 'Mimopráce do 5 %', earned: (r) => r.nonWorkPct <= 5 },
  { emoji: '🛡️', name: 'Čisté triko', desc: 'Žádná mimopráce', earned: (r) => r.nonWorkPct === 0 },
  { emoji: '🖥️', name: 'Dvojitý výhled', desc: 'Většinu času na 2+ monitorech', earned: (r) => r.multiMonitorPct >= 50 },
  { emoji: '🐝', name: 'Pracovitá včelka', desc: '140+ hodin aktivní práce', earned: (r) => r.activeHours >= 140 },
  { emoji: '🔥', name: 'Na plný plyn', desc: '170+ hodin aktivní práce', earned: (r) => r.activeHours >= 170 },
  { emoji: '🏃', name: 'Maraton prstů', desc: 'Prsty „ušly" přes 5 km', earned: (r) => r.distanceMeters >= 5000 },
  { emoji: '💪', name: 'Spalovač', desc: '400+ kcal spáleno psaním', earned: (r) => r.caloriesTyping >= 400 },
  { emoji: '⚡', name: 'Úhozový král', desc: '300 000+ úhozů za období', earned: (r) => r.keystrokeTotal >= 300000 },
];
function earnedBadges(r: SelfReportData): Badge[] {
  const got = BADGES.filter((b) => b.earned(r));
  return got.length ? got : [{ emoji: '🌱', name: 'Začátečník', desc: 'První odznaky na tebe čekají', earned: () => true }];
}

function Compare({ icon, label, pct, color, note }: { icon: React.ReactNode; label: string; pct: number; color: string; note: string }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">{icon} {label}</div>
      <div className="text-3xl font-bold leading-none" style={{ color }}>{pct}%</div>
      <div className="mb-2 mt-1 text-xs muted-2">{note}</div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function SelfReportView({ user, from, to }: { user: User; from: string; to: string }) {
  const [r, setR] = useState<SelfReportData | null>(null);
  const [tips, setTips] = useState<TipsData | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(true);
  const [funMode, setFunMode] = useState(false);
  const [healthMode, setHealthMode] = useState(false);
  const [growthMode, setGrowthMode] = useState(false);
  useEffect(() => { api.selfReport(user.id, from, to).then(setR).catch(() => setR(null)); }, [user.id, from, to]);
  useEffect(() => { api.tips().then(setTips).catch(() => setTips(null)); }, []);
  useEffect(() => { api.getSettings().then((d) => { setFunMode(d.settings.funMode); setHealthMode(d.settings.healthMode); setGrowthMode(d.settings.growthMode); }).catch(() => undefined); }, []);
  if (!r) return <p className="muted-2">Načítám…</p>;

  const distance = r.distanceMeters >= 1000 ? `${(r.distanceMeters / 1000).toFixed(1)} km` : `${r.distanceMeters} m`;
  // Zdravotní tip a „věděl jsi“ rotují po hodině, moudro dne jednou denně.
  const tip = tips ? rotate(tips.health, HOUR()) : undefined;
  const quote = tips ? rotate(tips.growth, DAY()) : undefined;
  const funFact = tips ? rotate(tips.fun, HOUR()) : undefined;

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

      {/* Rozvojový režim – moudro dne */}
      {growthMode && quote && (
        <div className="card flex items-start gap-3 border-indigo-200 p-5 dark:border-indigo-500/30">
          <Quote size={26} className="shrink-0 text-indigo-400" />
          <div>
            <div className="text-xs uppercase tracking-wide muted-2">Moudro dne</div>
            <blockquote className="text-lg font-medium italic">„{quote.text}"</blockquote>
            <div className="mt-1 text-sm muted">— {quote.author}</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Compare icon={<Users size={15} className="text-emerald-600" />} label="Ve firmě" pct={r.companyPercentile} color="#10b981" note="efektivnější než tolik kolegů" />
        <Compare icon={<Building2 size={15} className="text-emerald-600" />} label="Na oddělení" pct={r.deptPercentile} color="#0ea5e9" note="efektivnější než tolik kolegů" />
        <Compare icon={<Keyboard size={15} className="text-emerald-600" />} label="Rychlost psaní" pct={r.kpmPercentile} color="#8b5cf6" note="píšeš rychleji než tolik kolegů" />
      </div>

      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-emerald-500" /> Tvoje čísla za období</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Skóre efektivity" value={`${r.score} %`} />
          <Stat label="Aktivní práce" value={`${r.activeHours} h`} />
          <Stat label="Tempo psaní" value={`${r.avgKpm} úhozů/min`} />
          <Stat label="Monitory" value={r.monitorTypical ? `${r.monitorTypical} ${r.monitorTypical === 1 ? 'obrazovka' : 'obrazovky'}` : '—'} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Trophy size={16} className="mt-0.5 shrink-0" />
          <span>V psaní na klávesnici píšeš rychleji než <b>{r.kpmPercentile}&nbsp;%</b> kolegů a celkově jsi efektivnější než <b>{r.companyPercentile}&nbsp;%</b> firmy. Skvělé!</span>
        </div>
      </div>

      {/* Zábavný režim */}
      {funMode && (
        <div className="card p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-amber-500" /> Zábavný režim</h3>
          {(() => {
            const got = earnedBadges(r);
            return (
              <>
                <p className="mb-3 text-xs muted-2">Získané odznaky: <b>{got.length}</b> z {BADGES.length}. Sbírej je za výkon, soustředění i vytrvalost.</p>
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {got.map((b) => (
                    <div key={b.name} className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <span className="shrink-0 text-2xl leading-none">{b.emoji}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-amber-800 dark:text-amber-300">{b.name}</div>
                        <div className="text-[11px] leading-tight muted-2">{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          {funFact && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Sparkles size={16} className="mt-0.5 shrink-0" /> <span><b>Věděl jsi?</b> {funFact.text}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs uppercase muted-2"><Footprints size={13} /> Naťukaná vzdálenost</div>
              <div className="text-2xl font-bold">{distance}</div>
              <div className="text-xs muted-2">tolik nacestovaly tvé prsty po klávesnici</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs uppercase muted-2"><Flame size={13} /> Spáleno psaním</div>
              <div className="text-2xl font-bold">{r.caloriesTyping} kcal</div>
              <div className="text-xs muted-2">orientačně za zvolené období</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs uppercase muted-2"><Award size={13} /> Úhozů celkem</div>
              <div className="text-2xl font-bold">{r.keystrokeTotal.toLocaleString('cs-CZ')}</div>
              <div className="text-xs muted-2">to je pořádná porce práce!</div>
            </div>
          </div>
        </div>
      )}

      {/* Zdravotní režim – mikro-doporučení BEZ ztráty pozornosti (žádné přestávky) */}
      {healthMode && tip && (
        <div className="card border-rose-200 p-5 dark:border-rose-500/30">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-300"><HeartPulse size={16} /> Zdravotní mikro-tip</h3>
          <p className="mb-3 text-xs muted-2">Drobnost, kterou zvládnete při práci a nezabere pozornost déle než pár vteřin.</p>
          <div className="flex items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm dark:bg-rose-500/10">
            {catIcon(tip.category)} <span><b>Tip teď:</b> {tip.text}</span>
          </div>
          <p className="mt-3 text-xs muted-2">Tip se každou hodinu obměňuje. Orientační, nejde o lékařskou radu.</p>
        </div>
      )}

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
