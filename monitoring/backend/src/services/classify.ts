import type { CatType, CategoryInfo } from './categories.js';

/**
 * Klasifikace podle TITULKU okna (zejména pro prohlížeč). Klíčové slovo
 * v titulku → kategorie + typ. Rozšiřitelné. Porovnává se malými písmeny.
 *
 * Pozn.: titulek okna je osobní údaj a sbírá se jen při zapnutém režimu
 * (agent: CaptureWindowTitle). Informace pro zaměstnance + DPIA to musí krýt.
 */
export const TITLE_RULES: { match: string; category: string; type: CatType }[] = [
  // Mimopracovní
  { match: 'youtube', category: 'Video', type: 'NON_WORK' },
  { match: 'netflix', category: 'Video', type: 'NON_WORK' },
  { match: 'twitch', category: 'Video', type: 'NON_WORK' },
  { match: 'facebook', category: 'Sociální sítě', type: 'NON_WORK' },
  { match: 'instagram', category: 'Sociální sítě', type: 'NON_WORK' },
  { match: 'tiktok', category: 'Sociální sítě', type: 'NON_WORK' },
  { match: 'novinky', category: 'Zpravodajství', type: 'NON_WORK' },
  { match: 'idnes', category: 'Zpravodajství', type: 'NON_WORK' },
  { match: 'seznam.cz - e', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { match: 'gmail', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { match: 'hra', category: 'Hry', type: 'NON_WORK' },
  { match: 'game', category: 'Hry', type: 'NON_WORK' },
  { match: 'aukro', category: 'Nákupy', type: 'NON_WORK' },
  { match: 'alza', category: 'Nákupy', type: 'NON_WORK' },
  // Pracovní
  { match: 'jira', category: 'Práce – nástroje', type: 'WORK' },
  { match: 'confluence', category: 'Práce – nástroje', type: 'WORK' },
  { match: 'gitlab', category: 'Vývoj', type: 'WORK' },
  { match: 'github', category: 'Vývoj', type: 'WORK' },
  { match: 'sharepoint', category: 'Práce – nástroje', type: 'WORK' },
  { match: 'crm', category: 'Práce – nástroje', type: 'WORK' },
  { match: 'erp', category: 'Podnikový systém', type: 'WORK' },
];

/**
 * Vrátí kategorii aktivity z procesu + titulku okna.
 * 1) Pokud je proces jednoznačně pracovní/mimopracovní, použije se.
 * 2) Jinak (prohlížeč / neutrální / neznámý) se zkusí pravidla podle titulku.
 * 3) Fallback = kategorie procesu, jinak Ostatní/NEUTRAL.
 */
export function classifyActivity(
  catMap: Record<string, CategoryInfo>,
  app: string | null,
  windowTitle: string | null,
): CategoryInfo {
  const appInfo = app ? catMap[app] : undefined;
  if (appInfo && appInfo.type !== 'NEUTRAL') return appInfo;

  const t = (windowTitle ?? '').toLowerCase();
  if (t) {
    for (const rule of TITLE_RULES) {
      if (t.includes(rule.match)) return { category: rule.category, type: rule.type };
    }
  }
  return appInfo ?? { category: app ? 'Ostatní' : 'Bez aktivity', type: 'NEUTRAL' };
}
