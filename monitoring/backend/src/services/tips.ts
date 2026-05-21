import { prisma } from '../db.js';

export type TipKind = 'HEALTH' | 'GROWTH' | 'FUN';
export type TipSeed = { kind: TipKind; category?: string; text: string; author?: string };

/**
 * Výchozí sada tipů do reportu zaměstnance. Uloží se do DB (tabulka Tip) a dají
 * se odtud doplňovat/upravovat bez zásahu do kódu. Zdravotní tipy jsou
 * mikro-doporučení, která neberou pozornost od práce (žádné dlouhé přestávky).
 */
export const DEFAULT_TIPS: TipSeed[] = [
  // --- ZDRAVOTNÍ (HEALTH) ---
  { kind: 'HEALTH', category: 'air', text: 'Otevři na chvíli okno a vyvětrej – čerstvý vzduch a víc kyslíku zvednou soustředění.' },
  { kind: 'HEALTH', category: 'air', text: 'V dusnu pozornost rychle klesá – krátké vyvětrání nakopne mozek víc než káva.' },
  { kind: 'HEALTH', category: 'air', text: 'Po hodině práce na pár vteřin pootevři okno – pročistí hlavu i vzduch.' },
  { kind: 'HEALTH', category: 'stand', text: 'Postav se a chvíli pracuj ve stoje – prokrví nohy, aniž přestaneš pracovat.' },
  { kind: 'HEALTH', category: 'stand', text: 'Při čtení e-mailu se na chvíli zvedni – krev se rozproudí, hlava zůstane u práce.' },
  { kind: 'HEALTH', category: 'move', text: 'Zakruž kotníky pod stolem – nakopne oběh v nohou (pár vteřin).' },
  { kind: 'HEALTH', category: 'move', text: 'Sevři a povol lýtka 5× pod stolem – prevence těžkých nohou.' },
  { kind: 'HEALTH', category: 'move', text: 'Otevři a zavři dlaně 5× – uvolní prsty unavené z psaní.' },
  { kind: 'HEALTH', category: 'move', text: 'Krátce zakruž rameny – uvolní napětí z myši, trvá to 2 vteřiny.' },
  { kind: 'HEALTH', category: 'move', text: 'Protáhni prsty u nohou v botě – nenápadný mikrocvik při práci.' },
  { kind: 'HEALTH', category: 'move', text: 'Otoč hlavu pomalu vlevo a vpravo – uvolní krční svaly.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Narovnej záda a stáhni ramena dozadu – vydrž pár vteřin.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Horní okraj monitoru dej do výšky očí – uleví krční páteři.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Lokty drž zhruba v úhlu 90° – méně únavy předloktí.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Chodidla opři celou plochou o zem – stabilnější a zdravější sed.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Myš měj blízko klávesnice – kratší pohyby šetří rameno.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Zápěstí nepokládej na ostrou hranu stolu.' },
  { kind: 'HEALTH', category: 'ergo', text: 'Židli nastav tak, aby kolena byla v úhlu ~90°.' },
  { kind: 'HEALTH', category: 'eyes', text: 'Na 2 vteřiny se podívej z okna do dálky – odpočinou oči.' },
  { kind: 'HEALTH', category: 'eyes', text: 'Vědomě několikrát mrkni – obrazovka oči vysušuje.' },
  { kind: 'HEALTH', category: 'eyes', text: 'Posuň monitor zhruba na délku paže od očí.' },
  { kind: 'HEALTH', category: 'breath', text: 'Jeden pomalý nádech nosem a výdech – okysličí mozek pro soustředění.' },
  { kind: 'HEALTH', category: 'breath', text: 'Narovnej se a 3× se zhluboka nadechni – během chvilky.' },
  { kind: 'HEALTH', category: 'water', text: 'Dej si doušek vody – i mírná dehydratace snižuje výkon.' },
  { kind: 'HEALTH', category: 'water', text: 'Měj sklenici vody na dosah, ať kvůli ní nevstáváš.' },
  { kind: 'HEALTH', category: 'coffee', text: 'Kávu spíš dopoledne – odpolední ruší spánek a tím i zítřejší výkon.' },
  { kind: 'HEALTH', category: 'coffee', text: 'Po kávě sklenici vody – vyrovná odvodnění.' },
  { kind: 'HEALTH', category: 'focus', text: 'Zavři nepotřebné karty – méně přepínání, vyšší soustředění.' },
  { kind: 'HEALTH', category: 'focus', text: 'Ztlum notifikace a dokonči jeden úkol v kuse.' },
  { kind: 'HEALTH', category: 'focus', text: 'Velký úkol rozděl na 2–3 menší – rychlejší rozjezd.' },
  { kind: 'HEALTH', category: 'focus', text: 'Nejnáročnější úkol si dej na ráno, kdy je hlava nejsvěžejší.' },
  { kind: 'HEALTH', category: 'focus', text: 'Telefon polož mimo dosah – i ztišený láká pozornost.' },
  { kind: 'HEALTH', category: 'mood', text: 'Krátce se usměj – sníží stres a zlepší náladu i výkon. :)' },
  { kind: 'HEALTH', category: 'mood', text: 'Pochval se za hotový úkol – motivace táhne výkon.' },
  { kind: 'HEALTH', category: 'mood', text: 'Napiš si 3 věci, co dnes chceš stihnout – jasný cíl uklidní hlavu.' },

  // --- ROZVOJOVÝ REŽIM (GROWTH) – moudra velikánů ---
  { kind: 'GROWTH', text: 'Náš zákazník – náš pán.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Co chceš, můžeš.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Lidé nestojí o lacinou věc, ale o věc dobrou.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Než začneš pracovat, rozmysli si, co děláš a proč to děláš.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Neříkej, že to nejde, řekni, že to zatím neumíš.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Největší chybou je dělat všechno najednou a nic pořádně.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Slibuj méně, než kolik můžeš splnit.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Den má 86 400 vteřin – využij je.', author: 'Tomáš Baťa' },
  { kind: 'GROWTH', text: 'Nebát se a nekrást.', author: 'T. G. Masaryk' },
  { kind: 'GROWTH', text: 'Kdo chvíli stál, již stojí opodál.', author: 'Jan Neruda' },
  { kind: 'GROWTH', text: 'Kvalita znamená dělat věci správně, i když se nikdo nedívá.', author: 'Henry Ford' },
  { kind: 'GROWTH', text: 'Ať si myslíš, že to dokážeš, nebo ne – máš pravdu.', author: 'Henry Ford' },
  { kind: 'GROWTH', text: 'Spojit se je začátek, zůstat spolu je pokrok, spolupracovat je úspěch.', author: 'Henry Ford' },

  // --- ZÁBAVNÝ REŽIM (FUN) – „věděl jsi?" ---
  { kind: 'FUN', text: 'Tvé prsty po klávesnici „ujedou" týdně klidně i pár set metrů – patříš mezi tahouny!' },
  { kind: 'FUN', text: 'Soustředěný blok bez přepínání oken zvládne víc než hodina práce ve skocích.' },
  { kind: 'FUN', text: 'Dvě obrazovky ušetří desítky přepnutí denně – ruka i hlava si oddychnou.' },
  { kind: 'FUN', text: 'Plynulé tempo psaní dělá míň překlepů než zběsilé bušení.' },
  { kind: 'FUN', text: 'Doušek vody každou hodinu drží pozornost výš než další káva.' },
  { kind: 'FUN', text: 'Krátké vyvětrání dokáže „restartovat“ unavený mozek za pár vteřin.' },
];

/** Naplní tabulku Tip výchozí sadou (jen pokud je prázdná). */
export async function ensureDefaultTips(): Promise<void> {
  const count = await prisma.tip.count();
  if (count > 0) return;
  await prisma.tip.createMany({
    data: DEFAULT_TIPS.map((t) => ({ kind: t.kind, category: t.category ?? null, text: t.text, author: t.author ?? null })),
  });
}

export type TipsGrouped = {
  health: { category: string | null; text: string }[];
  growth: { text: string; author: string | null }[];
  fun: { text: string }[];
};

/** Vrátí aktivní tipy seskupené podle druhu (pro report zaměstnance). */
export async function getTips(): Promise<TipsGrouped> {
  const rows = await prisma.tip.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
  return {
    health: rows.filter((r) => r.kind === 'HEALTH').map((r) => ({ category: r.category, text: r.text })),
    growth: rows.filter((r) => r.kind === 'GROWTH').map((r) => ({ text: r.text, author: r.author })),
    fun: rows.filter((r) => r.kind === 'FUN').map((r) => ({ text: r.text })),
  };
}
