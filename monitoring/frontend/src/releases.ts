/**
 * Manuální seznam release notes pro dashboard.
 * Při každém bumpu verze (viz docs/RELEASING.md) sem přidej nový záznam.
 * Frontend zobrazuje:
 *   - banner "Vidíš novou verzi" 7 dní po deploy nebo dokud user nezavře
 *   - NEW badge u feature klíčů přes <NewBadge feature="..." />
 *   - Panel "Co je nového" v UserMenu (poslední 3 release)
 *
 * Při přidání feature do existující verze stačí přidat key do `features`.
 * Feature klíče se používají v JSX přes <NewBadge feature="kpiTypingMode" />.
 */

export type ReleaseHighlight = {
  version: string;
  date: string; // ISO YYYY-MM-DD
  title: string; // krátký podnadpis
  highlights: string[]; // 3–5 bullet pointů pro banner
  /**
   * Klíče features, které mají dostat NEW badge v UI. Přesný název je
   * dohoda mezi releases.ts a komponentou <NewBadge feature="..." />.
   * Po vydání další verze badge automaticky zmizí (jen aktuální release má badge).
   */
  features: string[];
};

/** Aktuální release - na začátku pole. Po release+1 sjede na index 1 atd. */
export const RELEASES: ReleaseHighlight[] = [
  {
    version: '0.9.4',
    date: '2026-05-29',
    title: 'Risk signály, Basic/Pro režim, NO-AI policy',
    highlights: [
      'Akční doporučení manažerovi — burnout risk, flight risk, declining performance, boost signal — místo raw čísel rovnou „pozvi na 1:1" / „naplánuj retention talk" / „pochval/povýš"',
      'Per-user baseline (30 dní) + engagement trend (7 dní vs baseline) — vidíš změny vůči vlastnímu průměru, ne firemnímu',
      'Basic / Pro režim v avatar menu — basic = klíčové ukazatele (manažer), pro = vše do hloubky (auditor/DPO). Per-account persistence.',
      'Stahování agenta pro Windows + macOS přímo z dashboardu (v Dev Mode)',
      'Skóre konzistentní napříč kartami — trend graf nyní ukazuje stejné číslo jako scoreboard pro stejného uživatele (fix P0)',
      'Unifikovaný design systém (card-dense, kpi-label, btn-danger, badge-*)',
      'NO-AI POLICY: produkční kód NESMÍ volat OpenAI / Anthropic / Google AI / Bedrock / atd. CI lint to vynucuje.',
    ],
    features: [
      'riskSignals',
      'insightsPanel',
      'basicProMode',
      'agentDownload',
      'scoreConsistency',
      'designSystemV094',
      'noAiPolicy',
    ],
  },
  {
    version: '0.9.3',
    date: '2026-05-28',
    title: 'Realistická demo data + detekce podvádění',
    highlights: [
      '20 uživatelů spouští software obcházející monitoring (mouse jiggler, AutoHotkey, Caffeine, autoclicker, Process Hacker…) — nový alert typ Obcházení monitoringu',
      '~60 uživatelů s aktivitou po 21:00 — nový alert AFTER_HOURS_ACTIVITY (workaholici, IT on-call, ale i botové)',
      'Realistická škála aktivního času — 15-min intervaly správně reprezentují 15 minut (skóre 2 % → ~ 55 %)',
      'Svátky a víkendy: seed respektuje státní svátky CZ, ~6 % firmy má víkendovou aktivitu (IT support, on-call)',
      'Home office dip dle výzkumu — průměrně −15-20 %, persona-specific (slacker −45 %, top −8 %)',
      '10 person s širokou variance baseDiligence (top 0.94-0.99, slacker 0.25-0.50)',
      'Performance: alerts + heatmap cached, +warm cache při startu',
      'Bulk integrity check: 1991 sekvenčních query → 1 bulk (100× rychlejší /alerts)',
    ],
    features: [
      'evasionSoftware',
      'afterHoursActivity',
      'realisticDemoData',
      'holidaysWeekends',
      'homeOfficeDip',
      'broadPersonaVariance',
    ],
  },
  {
    version: '0.9.2',
    date: '2026-05-27',
    title: 'Pilot iterace: UX, výkon, macOS',
    highlights: [
      'Developer Mode (toggle v menu) — ⓘ vysvětlivky u metrik s metodikou výpočtu',
      'Top weby v Klasifikaci klikatelné — inline změna typu (Práce / Zábava)',
      'Statistika "Mimo PC" už neukazuje hodiny před nasazením agenta',
      'Sort + filter + pagination ve velkých tabulkách',
      'Empty states s tlačítkem "Stáhnout agenta" pro onboarding',
      'Frontend bundle -31 % díky lazy loadingu komponent',
      'macOS agent: .app bundle + ad-hoc codesign (TCC permissions přežijí update)',
      'Demo Print/USB data pro plnou ukázku sekce',
    ],
    features: [
      'devMode',
      'typingKpm',
      'pagination',
      'emptyStateOnboarding',
      'topActivitiesClassify',
      'printUsbDrilldown',
      'mimoPcClamp',
      'changelogPanel',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-05-26',
    title: 'Release candidate (pilot-ready)',
    highlights: [
      'Per-device enrollment tokeny (S4)',
      '5jazyčné UI (CS / SK / EN / PL / DE)',
      'GDPR čl. 17 + 20: DELETE + EXPORT endpointy',
      'Prometheus /api/v1/metrics',
      'Tisk & USB monitoring (opt-in)',
    ],
    features: [],
  },
];

/** Aktuální verze (= první položka). Frontend ji porovnává s localStorage. */
export const CURRENT_VERSION = RELEASES[0].version;

/**
 * Vrátí seznam features označených jako "nové" pro aktuální verzi.
 * Po update se localStorage `focus_seen_version` aktualizuje na CURRENT,
 * features pak přestávají blikat NEW.
 */
export function newFeatureKeys(): Set<string> {
  const seen = localStorage.getItem('focus_seen_version');
  // Pokud user vidí poprvé nebo má staršího (== nikoli aktualni) verzi,
  // ukaž NEW features aktuální verze.
  if (seen === CURRENT_VERSION) return new Set();
  return new Set(RELEASES[0].features);
}

/** Označí aktuální verzi jako "viděnou" – NEW badges zmizí. */
export function markReleaseSeen(): void {
  localStorage.setItem('focus_seen_version', CURRENT_VERSION);
}

/** True pokud user ještě neviděl release banner pro aktuální verzi. */
export function shouldShowReleaseBanner(): boolean {
  return localStorage.getItem('focus_seen_version') !== CURRENT_VERSION;
}
