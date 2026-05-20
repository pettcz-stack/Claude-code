import { prisma } from '../db.js';

/** Výchozí kategorizace běžných aplikací. Lze rozšířit/upravit v DB. */
export const DEFAULT_CATEGORIES: Record<string, string> = {
  'winword.exe': 'Práce',
  'excel.exe': 'Práce',
  'powerpnt.exe': 'Práce',
  'code.exe': 'Práce',
  'devenv.exe': 'Práce',
  'outlook.exe': 'Komunikace',
  'teams.exe': 'Komunikace',
  'slack.exe': 'Komunikace',
  'chrome.exe': 'Web',
  'msedge.exe': 'Web',
  'firefox.exe': 'Web',
};

/** Naplní tabulku AppCategory výchozími hodnotami (jen pokud je prázdná). */
export async function ensureDefaultCategories(): Promise<void> {
  const count = await prisma.appCategory.count();
  if (count > 0) return;
  await prisma.appCategory.createMany({
    data: Object.entries(DEFAULT_CATEGORIES).map(([appName, category]) => ({ appName, category })),
  });
}

/** Vrátí mapu appName → kategorie. */
export async function getCategoryMap(): Promise<Record<string, string>> {
  const rows = await prisma.appCategory.findMany({ select: { appName: true, category: true } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.appName] = r.category;
  return map;
}
