/**
 * Detekce prohlížeče + extrakce domény z titulku okna (best-effort).
 *
 * Prohlížeče v `BROWSER_APPS` pokrývají jak Windows (".exe"), tak macOS
 * (NSWorkspace.frontmostApplication.localizedName, např. "Google Chrome").
 * Porovnává se case-insensitive – agent posílá hodnoty různě podle OS.
 *
 * Soukromí: pro top weby ukládáme jen doménu (ne celý titulek), aby
 * nebylo vidět "Plat 90 000 Kč - Banka" apod.
 */

const BROWSER_APPS = new Set([
  // Windows
  'chrome.exe', 'msedge.exe', 'firefox.exe', 'iexplore.exe', 'opera.exe', 'brave.exe', 'vivaldi.exe',
  // macOS (localizedName z NSWorkspace)
  'google chrome', 'chrome', 'safari', 'firefox', 'microsoft edge', 'arc',
  'brave browser', 'opera', 'vivaldi', 'chromium',
]);

const DOMAIN_RE = /\b([a-z0-9-]{2,}(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/i;

/** True, pokud aplikace je prohlížeč (tam má extrakce domény smysl). */
export function isBrowser(app: string | null | undefined): boolean {
  return !!app && BROWSER_APPS.has(app.toLowerCase());
}

/**
 * Najde první doménu v titulku okna. Pokud nic nenajde, vrátí null.
 * Filtruje zjevné šumy (např. „chrome.exe", „word.exe" – ty mají TLD jako .exe).
 */
export function extractDomain(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = title.match(DOMAIN_RE);
  if (!m) return null;
  const d = m[1].toLowerCase();
  // Ignoruj přípony aplikací, soubory, IP.
  if (/\.(exe|dll|sys|tmp|log|txt|pdf|docx?|xlsx?|pptx?|zip|rar)$/.test(d)) return null;
  if (/^\d+(\.\d+){3}$/.test(d)) return null;
  // Strip "www." prefix pro pěkné zobrazení.
  return d.startsWith('www.') ? d.slice(4) : d;
}

/**
 * Label pro top-weby agregaci. Snaží se vrátit doménu (`youtube.com`,
 * `github.com`), jinak fallback na zkrácený titulek. Důležité pro UX:
 * jinak by každá podstránka byla samostatný řádek v top sites.
 */
export function extractSiteLabel(app: string | null | undefined, title: string | null | undefined): string | null {
  if (!title) return null;
  if (!isBrowser(app)) return null;
  const dom = extractDomain(title);
  if (dom) return dom;
  // Když je to prohlížeč, ale doménu jsme nenašli (např. local file, intranet
  // bez .tld v titulku), použij zkrácený titulek – ať uživatel aspoň něco vidí.
  return title.length > 64 ? title.slice(0, 64) : title;
}

/**
 * Vrátí titulek pro uložení podle nastavení soukromí:
 *  - když je `privacyStoreDomainOnly` true a aplikace je prohlížeč → jen doména
 *    (nebo „[prohlížeč]" když se nepodaří doménu rozpoznat).
 *  - jinak vrátí původní titulek (zkrácený na rozumnou délku).
 */
export function sanitizeWindowTitle(app: string | null | undefined, title: string | null | undefined, storeDomainOnly: boolean): string | null {
  if (!title) return null;
  if (storeDomainOnly && isBrowser(app)) {
    const d = extractDomain(title);
    return d ?? '[prohlížeč]';
  }
  // Limit délky pro jistotu.
  return title.length > 256 ? title.slice(0, 256) : title;
}
