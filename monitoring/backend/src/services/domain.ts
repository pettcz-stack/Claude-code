/**
 * Extrakce domény z titulku okna prohlížeče (best-effort).
 * Mnoho prohlížečů uvádí v titulku „Stránka - example.com - Browser" nebo podobně.
 * Soukromí: ukládáme jen doménu, ne celý titulek (často obsahuje jména, e-maily atd.).
 */

const BROWSER_APPS = new Set([
  'chrome.exe', 'msedge.exe', 'firefox.exe', 'iexplore.exe', 'opera.exe', 'brave.exe', 'vivaldi.exe',
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
  return d;
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
