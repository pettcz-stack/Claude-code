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
