import { prisma } from '../db.js';
import type { CatType } from './categories.js';

export type DeptRule = { department: string; category: string; type: CatType };

/**
 * Výchozí přepisy podle oddělení. LinkedIn je pro HR/nábor PRÁCE (recruiting),
 * pro ostatní zůstává zábava. Pokrýváme běžné názvy HR oddělení.
 */
export const DEFAULT_DEPT_RULES: DeptRule[] = [
  { department: 'Personalistika', category: 'LinkedIn', type: 'WORK' },
  { department: 'HR', category: 'LinkedIn', type: 'WORK' },
  { department: 'Nábor', category: 'LinkedIn', type: 'WORK' },
];

/** Doplní chybějící výchozí pravidla (nepřepisuje ručně upravená). */
export async function ensureDefaultDeptRules(): Promise<void> {
  for (const r of DEFAULT_DEPT_RULES) {
    await prisma.deptClassification.upsert({
      where: { department_category: { department: r.department, category: r.category } },
      create: r,
      update: {},
    });
  }
}

/** Mapa oddělení → (kategorie → typ). */
export async function getDeptRules(): Promise<Map<string, Map<string, CatType>>> {
  const rows = await prisma.deptClassification.findMany();
  const m = new Map<string, Map<string, CatType>>();
  for (const r of rows) {
    let inner = m.get(r.department);
    if (!inner) { inner = new Map(); m.set(r.department, inner); }
    inner.set(r.category, r.type as CatType);
  }
  return m;
}
