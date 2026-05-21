import { prisma } from '../db.js';

// UNKNOWN = nezařazeno; vyjmuto ze statistik (nejde do + ani −), dokud admin nerozhodne.
export type CatType = 'WORK' | 'NON_WORK' | 'NEUTRAL' | 'UNKNOWN';

export type CatDef = { appName: string; category: string; type: CatType };

/**
 * Výchozí kategorizace aplikací (proces) + typ pro skóre.
 *  WORK     – pracovní nástroje (zelená)
 *  NON_WORK – mimopracovní (červená): hry, sociální sítě, soukromý mail…
 *  NEUTRAL  – nejednoznačné (např. obecný prohlížeč) – do skóre se počítá jako práce
 *
 * Pozn.: rozlišení AKTIVIT UVNITŘ prohlížeče (hry/soukromý mail/zprávy) vyžaduje
 * sběr domény/titulku – ten zatím nesbíráme (soukromí §316). Položky s doménami
 * níže jsou připravené pro budoucí doménový režim a slouží i pro demo.
 */
export const DEFAULT_CATEGORIES: CatDef[] = [
  // Práce
  { appName: 'winword.exe', category: 'Kancelář', type: 'WORK' },
  { appName: 'excel.exe', category: 'Kancelář', type: 'WORK' },
  { appName: 'powerpnt.exe', category: 'Kancelář', type: 'WORK' },
  { appName: 'code.exe', category: 'Vývoj', type: 'WORK' },
  { appName: 'devenv.exe', category: 'Vývoj', type: 'WORK' },
  { appName: 'outlook.exe', category: 'E-mail', type: 'WORK' },
  { appName: 'teams.exe', category: 'Komunikace', type: 'WORK' },
  { appName: 'slack.exe', category: 'Komunikace', type: 'WORK' },
  { appName: 'sap.exe', category: 'Podnikový systém', type: 'WORK' },
  { appName: 'okbase.exe', category: 'Podnikový systém', type: 'WORK' },
  // Neutrální
  { appName: 'chrome.exe', category: 'Prohlížeč', type: 'NEUTRAL' },
  { appName: 'msedge.exe', category: 'Prohlížeč', type: 'NEUTRAL' },
  { appName: 'firefox.exe', category: 'Prohlížeč', type: 'NEUTRAL' },
  { appName: 'explorer.exe', category: 'Systém', type: 'NEUTRAL' },
  // Mimopracovní
  { appName: 'steam.exe', category: 'Hry', type: 'NON_WORK' },
  { appName: 'epicgameslauncher.exe', category: 'Hry', type: 'NON_WORK' },
  { appName: 'leagueclient.exe', category: 'Hry', type: 'NON_WORK' },
  { appName: 'spotify.exe', category: 'Hudba/zábava', type: 'NON_WORK' },
  { appName: 'whatsapp.exe', category: 'Soukromé zprávy', type: 'NON_WORK' },
  { appName: 'telegram.exe', category: 'Soukromé zprávy', type: 'NON_WORK' },
  // Demo: domény (využijí se až při doménovém režimu)
  { appName: 'facebook.com', category: 'Sociální sítě', type: 'NON_WORK' },
  { appName: 'instagram.com', category: 'Sociální sítě', type: 'NON_WORK' },
  { appName: 'seznam.cz/email', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { appName: 'gmail.com', category: 'Soukromý e-mail', type: 'NON_WORK' },
  { appName: 'novinky.cz', category: 'Zpravodajství', type: 'NON_WORK' },
  { appName: 'youtube.com', category: 'Video', type: 'NON_WORK' },
];

/** Naplní/aktualizuje tabulku AppCategory (upsert – doplní i typy u existujících). */
export async function ensureDefaultCategories(): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.appCategory.upsert({
      where: { appName: c.appName },
      create: { appName: c.appName, category: c.category, type: c.type },
      update: { category: c.category, type: c.type },
    });
  }
}

export type CategoryInfo = { category: string; type: CatType };

/** Vrátí mapu appName → {category, type}. */
export async function getCategoryMap(): Promise<Record<string, CategoryInfo>> {
  const rows = await prisma.appCategory.findMany({ select: { appName: true, category: true, type: true } });
  const map: Record<string, CategoryInfo> = {};
  for (const r of rows) map[r.appName] = { category: r.category, type: r.type as CatType };
  return map;
}
