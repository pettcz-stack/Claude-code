import { prisma } from '../db.js';
import type { CatType, CategoryInfo } from './categories.js';

/** Výchozí pravidla pro klasifikaci podle titulku okna (zejména weby). */
export const DEFAULT_WEB_RULES: { keyword: string; category: string; type: CatType }[] = [
  // --- Mimopracovní ---------------------------------------------------------
  // Porno / erotika
  { keyword: 'pornhub', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'xvideos', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'xhamster', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'xnxx', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'redtube', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'youporn', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'spankbang', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'brazzers', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'onlyfans', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'stripchat', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'chaturbate', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'livejasmin', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'eporner', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'porno', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'porn', category: 'Porno', type: 'NON_WORK' },
  { keyword: 'erotik', category: 'Porno', type: 'NON_WORK' },
  // Video / streaming
  { keyword: 'youtube', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'netflix', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'twitch', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'hbo max', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'disney+', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'voyo', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'iprima', category: 'Video / streaming', type: 'NON_WORK' },
  { keyword: 'stream.cz', category: 'Video / streaming', type: 'NON_WORK' },
  // Hudba
  { keyword: 'spotify', category: 'Hudba', type: 'NON_WORK' },
  { keyword: 'soundcloud', category: 'Hudba', type: 'NON_WORK' },
  // Sociální sítě
  { keyword: 'facebook', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'messenger', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'instagram', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'tiktok', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'twitter', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'reddit', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'snapchat', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'pinterest', category: 'Sociální sítě', type: 'NON_WORK' },
  { keyword: 'linkedin', category: 'Sociální sítě', type: 'NON_WORK' }, // u recruiterů zvaž změnu na WORK
  // Zpravodajství
  { keyword: 'novinky', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'idnes', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'seznam zprávy', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'aktuálně', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'aktualne.cz', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'ct24', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'irozhlas', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'denik.cz', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'blesk', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'lidovky', category: 'Zpravodajství', type: 'NON_WORK' },
  { keyword: 'zprávy', category: 'Zpravodajství', type: 'NON_WORK' },
  // Sport
  { keyword: 'isport', category: 'Sport', type: 'NON_WORK' },
  { keyword: 'livesport', category: 'Sport', type: 'NON_WORK' },
  { keyword: 'flashscore', category: 'Sport', type: 'NON_WORK' },
  // Nákupy
  { keyword: 'aukro', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'alza', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'mall.cz', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'datart', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'notino', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'zalando', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'temu', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'shein', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'bazos', category: 'Nákupy', type: 'NON_WORK' },
  { keyword: 'heureka', category: 'Nákupy', type: 'NON_WORK' },
  // Hry
  { keyword: 'hra', category: 'Hry', type: 'NON_WORK' },
  { keyword: 'game', category: 'Hry', type: 'NON_WORK' },
  { keyword: 'steam', category: 'Hry', type: 'NON_WORK' },
  // Sázení / gambling
  { keyword: 'sazka', category: 'Sázení', type: 'NON_WORK' },
  { keyword: 'tipsport', category: 'Sázení', type: 'NON_WORK' },
  { keyword: 'fortuna', category: 'Sázení', type: 'NON_WORK' },
  { keyword: 'betano', category: 'Sázení', type: 'NON_WORK' },
  { keyword: 'casino', category: 'Sázení', type: 'NON_WORK' },
  { keyword: 'kasino', category: 'Sázení', type: 'NON_WORK' },
  // Seznamky
  { keyword: 'tinder', category: 'Seznamky', type: 'NON_WORK' },
  { keyword: 'badoo', category: 'Seznamky', type: 'NON_WORK' },
  { keyword: 'seznamka', category: 'Seznamky', type: 'NON_WORK' },
  // Cestování / volný čas
  { keyword: 'booking.com', category: 'Cestování', type: 'NON_WORK' },
  { keyword: 'airbnb', category: 'Cestování', type: 'NON_WORK' },
  { keyword: 'letenky', category: 'Cestování', type: 'NON_WORK' },
  // Soukromý e-mail
  { keyword: 'seznam.cz - e', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { keyword: 'email.seznam', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { keyword: 'gmail', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { keyword: 'centrum.cz', category: 'Soukromý e-mail', type: 'NON_WORK' },
  // --- Pracovní -------------------------------------------------------------
  { keyword: 'jira', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'confluence', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'sharepoint', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'onedrive', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'microsoft 365', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'office 365', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'google docs', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'google sheets', category: 'Práce – nástroje', type: 'WORK' },
  { keyword: 'gitlab', category: 'Vývoj', type: 'WORK' },
  { keyword: 'github', category: 'Vývoj', type: 'WORK' },
  { keyword: 'crm', category: 'CRM', type: 'WORK' },
  { keyword: 'dynamics', category: 'CRM', type: 'WORK' },
  { keyword: 'salesforce', category: 'CRM', type: 'WORK' },
  { keyword: 'erp', category: 'Podnikový systém', type: 'WORK' },
  { keyword: 'navision', category: 'Podnikový systém', type: 'WORK' },
  { keyword: 'helios', category: 'Podnikový systém', type: 'WORK' },
  { keyword: 'pohoda', category: 'Podnikový systém', type: 'WORK' },
  { keyword: 'money s3', category: 'Podnikový systém', type: 'WORK' },
  { keyword: 'intranet', category: 'Intranet', type: 'WORK' },
  { keyword: 'okbase', category: 'Docházka / HR', type: 'WORK' },
  { keyword: 'power bi', category: 'Reporty', type: 'WORK' },
];

export type WebRule = { keyword: string; category: string; type: CatType };

/**
 * Doplní CHYBĚJÍCÍ výchozí pravidla (podle klíčového slova). Existující pravidla
 * (vč. úprav admina) nechá beze změny → po aktualizaci se přidají nová pravidla,
 * aniž by se přepsala ta ručně upravená. SQLite-safe (bez skipDuplicates).
 */
export async function ensureDefaultWebRules(): Promise<void> {
  for (const r of DEFAULT_WEB_RULES) {
    await prisma.webRule.upsert({
      where: { keyword: r.keyword },
      create: r,
      update: {},
    });
  }
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
