import { useEffect, useState } from 'react';
import { ShieldCheck, X, Keyboard, Trophy, Users, Building2, Sparkles, Award, Footprints, Flame, HeartPulse, PersonStanding, GlassWater, Eye, Coffee, Wind, Target, Armchair, Activity, Quote } from 'lucide-react';
import { api, type SelfReportData, type User } from './api.js';

// Mikro-doporučení, která NEBEROU pozornost od práce (max pár vteřin, často
// se dají dělat vstoje/u práce). Žádné přestávky – cílem je výkon i pohoda.
type Cat = 'stand' | 'move' | 'eyes' | 'breath' | 'water' | 'coffee' | 'ergo' | 'focus' | 'mood';
const TIPS: { cat: Cat; text: string }[] = [
  { cat: 'stand', text: 'Postavte se a chvíli pracujte ve stoje – prokrví nohy, aniž přestanete pracovat.' },
  { cat: 'stand', text: 'Při čtení e-mailu se na chvíli zvedněte – krev se rozproudí, hlava zůstane u práce.' },
  { cat: 'move', text: 'Zakružte kotníky pod stolem – nakopne oběh v nohou (pár vteřin).' },
  { cat: 'move', text: 'Sevřete a povolte lýtka 5× pod stolem – prevence těžkých nohou.' },
  { cat: 'move', text: 'Otevřete a zavřete dlaně 5× – uvolní prsty unavené z psaní.' },
  { cat: 'move', text: 'Krátce zakružte rameny – uvolní napětí z myši, trvá to 2 vteřiny.' },
  { cat: 'move', text: 'Protáhněte prsty u nohou v botě – nenápadný mikrocvik při práci.' },
  { cat: 'ergo', text: 'Narovnejte záda a stáhněte ramena dozadu – vydržte pár vteřin.' },
  { cat: 'ergo', text: 'Horní okraj monitoru dejte do výšky očí – uleví krční páteři.' },
  { cat: 'ergo', text: 'Lokty držte zhruba v úhlu 90° – méně únavy předloktí.' },
  { cat: 'ergo', text: 'Chodidla opřete celou plochou o zem – stabilnější a zdravější sed.' },
  { cat: 'ergo', text: 'Myš mějte blízko klávesnice – kratší pohyby šetří rameno.' },
  { cat: 'ergo', text: 'Zápěstí nepokládejte na ostrou hranu stolu.' },
  { cat: 'ergo', text: 'Židli nastavte tak, aby kolena byla v úhlu ~90°.' },
  { cat: 'eyes', text: 'Na 2 vteřiny se podívejte z okna do dálky – odpočinou oči.' },
  { cat: 'eyes', text: 'Vědomě několikrát mrkněte – obrazovka oči vysušuje.' },
  { cat: 'eyes', text: 'Posuňte monitor zhruba na délku paže od očí.' },
  { cat: 'breath', text: 'Jeden pomalý nádech nosem a výdech – okysličí mozek pro soustředění.' },
  { cat: 'breath', text: 'Narovnejte se a 3× se zhluboka nadechněte – během chvilky.' },
  { cat: 'water', text: 'Dejte si doušek vody – i mírná dehydratace snižuje výkon.' },
  { cat: 'water', text: 'Mějte sklenici vody na dosah, ať kvůli ní nevstáváte.' },
  { cat: 'coffee', text: 'Kávu spíš dopoledne – odpolední ruší spánek a tím i zítřejší výkon.' },
  { cat: 'coffee', text: 'Po kávě sklenici vody – vyrovná odvodnění.' },
  { cat: 'focus', text: 'Zavřete nepotřebné karty – méně přepínání, vyšší soustředění.' },
  { cat: 'focus', text: 'Ztlumte notifikace a dokončete jeden úkol v kuse.' },
  { cat: 'focus', text: 'Velký úkol rozdělte na 2–3 menší – rychlejší rozjezd.' },
  { cat: 'mood', text: 'Krátce se usmějte – sníží stres a zlepší náladu i výkon. :)' },
  { cat: 'mood', text: 'Pochvalte se za hotový úkol – motivace táhne výkon.' },
];

const CAT_ICON: Record<Cat, React.ReactNode> = {
  stand: <PersonStanding size={16} className="text-rose-500" />,
  move: <Activity size={16} className="text-emerald-500" />,
  eyes: <Eye size={16} className="text-violet-500" />,
  breath: <Wind size={16} className="text-sky-500" />,
  water: <GlassWater size={16} className="text-sky-500" />,
  coffee: <Coffee size={16} className="text-amber-700" />,
  ergo: <Armchair size={16} className="text-teal-500" />,
  focus: <Target size={16} className="text-indigo-500" />,
  mood: <HeartPulse size={16} className="text-rose-500" />,
};

// Rozvojový režim – moudra velikánů, jedno na celý den.
const QUOTES: { text: string; author: string }[] = [
  { text: 'Náš zákazník – náš pán.', author: 'Tomáš Baťa' },
  { text: 'Co chceš, můžeš.', author: 'Tomáš Baťa' },
  { text: 'Lidé nestojí o lacinou věc, ale o věc dobrou.', author: 'Tomáš Baťa' },
  { text: 'Než začneš pracovat, rozmysli si, co děláš a proč to děláš.', author: 'Tomáš Baťa' },
  { text: 'Neříkej, že to nejde, řekni, že to zatím neumíš.', author: 'Tomáš Baťa' },
  { text: 'Největší chybou je dělat všechno najednou a nic pořádně.', author: 'Tomáš Baťa' },
  { text: 'Slibuj méně, než kolik můžeš splnit.', author: 'Tomáš Baťa' },
  { text: 'Den má 86 400 vteřin – využij je.', author: 'Tomáš Baťa' },
  { text: 'Nebát se a nekrást.', author: 'T. G. Masaryk' },
  { text: 'Kdo chvíli stál, již stojí opodál.', author: 'Jan Neruda' },
  { text: 'Práce je nejlepší způsob, jak si užít život.', author: 'Immanuel Kant' },
  { text: 'Kvalita znamená dělat věci správně, i když se nikdo nedívá.', author: 'Henry Ford' },
  { text: 'Ať si myslíš, že to dokážeš, nebo ne – máš pravdu.', author: 'Henry Ford' },
  { text: 'Spojit se je začátek, zůstat spolu je pokrok, spolupracovat je úspěch.', author: 'Henry Ford' },
];

function quoteOfDay(): { text: string; author: string } {
  return QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length];
}

/** Deterministicky vybere N tipů „pro dnešek" (mění se den ode dne). */
function pickTips(n: number): { cat: Cat; text: string }[] {
  const seed = Math.floor(Date.now() / 86400000); // den
  const out: { cat: Cat; text: string }[] = [];
  for (let i = 0; i < n; i++) out.push(TIPS[(seed * 7 + i * 5) % TIPS.length]);
  return out;
}

function badges(r: SelfReportData): string[] {
  const b: string[] = [];
  if (r.kpmPercentile >= 80) b.push('🏎️ Rychloprsťák');
  if (r.score >= 70) b.push('⭐ Tahoun týmu');
  if (r.companyPercentile >= 75) b.push('🏆 TOP firmy');
  if (r.appSwitchesPerHour > 0 && r.appSwitchesPerHour <= 8) b.push('🎯 Soustředěný');
  if (r.nonWorkPct <= 5) b.push('💎 Bez rozptýlení');
  return b.length ? b : ['🌱 Začátečník'];
}

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
  const [funMode, setFunMode] = useState(false);
  const [healthMode, setHealthMode] = useState(false);
  const [growthMode, setGrowthMode] = useState(false);
  useEffect(() => { api.selfReport(user.id, from, to).then(setR).catch(() => setR(null)); }, [user.id, from, to]);
  useEffect(() => { api.getSettings().then((d) => { setFunMode(d.settings.funMode); setHealthMode(d.settings.healthMode); setGrowthMode(d.settings.growthMode); }).catch(() => undefined); }, []);
  if (!r) return <p className="muted-2">Načítám…</p>;

  const distance = r.distanceMeters >= 1000 ? `${(r.distanceMeters / 1000).toFixed(1)} km` : `${r.distanceMeters} m`;
  const tips = pickTips(6);
  const quote = quoteOfDay();

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
      {growthMode && (
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

      {/* Zábavný režim */}
      {funMode && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-amber-500" /> Zábavný režim</h3>
          <div className="mb-4 flex flex-wrap gap-2">
            {badges(r).map((b) => (
              <span key={b} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{b}</span>
            ))}
          </div>
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
      {healthMode && (
        <div className="card border-rose-200 p-5 dark:border-rose-500/30">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-300"><HeartPulse size={16} /> Zdravotní mikro-tipy</h3>
          <p className="mb-3 text-xs muted-2">Drobnosti, které zvládnete při práci a neberou pozornost déle než pár vteřin.</p>
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm dark:bg-rose-500/10">
            {CAT_ICON[tips[0].cat]} <span><b>Tip teď:</b> {tips[0].text}</span>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {tips.slice(1).map((t, i) => (
              <li key={i} className="flex items-start gap-2 muted">{CAT_ICON[t.cat]} {t.text}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs muted-2">Tipy se každý den obměňují. Orientační, nejde o lékařskou radu.</p>
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
