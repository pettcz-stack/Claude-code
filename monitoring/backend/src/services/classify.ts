import { prisma } from '../db.js';
import type { CatType, CategoryInfo } from './categories.js';

/** Výchozí pravidla pro klasifikaci podle titulku okna (zejména weby). */
export const DEFAULT_WEB_RULES: { keyword: string; category: string; type: CatType }[] = [
  // Mimopracovní
  { keyword: 'youtube', category: 'Video', type: 'NON_WORK' },
  { keyword: 'netflix', category: 'Video', type: 'NON_WORK' },
  { keyword: 'twitch', category: 'Video', type: 'NON_WORK' },
  { keyword: 'facebook', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'instagram', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'tiktok', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'novinky', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'idnes', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'seznam.cz - e', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { keyword: 'gmail', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { keyword: 'hra', category: 'Hry', type: 'NON_WORK' },
  { keyword: 'game', category: 'Hry', type: 'NON_WORK' },
  { keyword: 'aukro', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'alza', category: 'Nákupy', type: 'NON_WORK' },
  // Pracovní
  { keyword: 'jira', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'confluence', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'gitlab', category: 'Vývoj', type: 'WORK' },
  { keyword: 'github', category: 'Vývoj', type: 'WORK' },
  { keyword: 'sharepoint', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'crm', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'erp', category: 'Podnikový systém', type: 'WORK' },
];

export type WebRule = { keyword: string; category: string; type: CatType };

/** Naplní tabulku WebRule výchozími pravidly (jen pokud je prázdná). */
export async function ensureDefaultWebRules(): Promise<void> {
  const count = await prisma.webRule.count();
  if (count > 0) return;
  await prisma.webRule.createMany({ data: DEFAULT_WEB_RULES });
}

export async function getWebRules(): Promise<WebRule[]> {
  const rows = await prisma.webRule.findMany({ select: { keyword: true, category: true, type: true } });
  return rows.map((r) => ({ keyword: r.keyword, category: r.category, type: r.type as CatType }));
}

/**
 * Vrátí kategorii aktivity z procesu + titulku okna.
 * 1) Jednoznačně pracovní/mimopracovní proces → použije se.
 * 2) Jinak (prohlížeč / neutrální / neznámý) → pravidla podle titulku.
 * 3) Fallback = kategorie procesu, jinak Ostatní/NEUTRAL.
 */
export function classifyActivity(
  catMap: Record<string, CategoryInfo>,
  webRules: WebRule[],
  app: string | null,
  windowTitle: string | null,
): CategoryInfo {
  const appInfo = app ? catMap[app] : undefined;
  if (appInfo && appInfo.type !== 'NEUTRAL') return appInfo;

  const t = (windowTitle ?? '').toLowerCase();
  if (t) {
    for (const rule of webRules) {
      if (rule.keyword && t.includes(rule.keyword.toLowerCase())) {
        return { category: rule.category, type: rule.type };
      }
    }
  }
  // Nic nesedí → NEZAŘAZENO (vyjmuto ze statistik, dokud admin nerozhodne).
  return appInfo ?? { category: app ? 'Nezařazeno' : 'Bez aktivity', type: 'UNKNOWN' };
}
