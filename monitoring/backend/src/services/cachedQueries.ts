import { memo } from './cache.js';
import { overview, monitorsComparison, softwareAudit, costAudit, homeOffice, selfReport, trend, topActivities } from './analytics.js';
import { scoreboardRows } from './scoring.js';
import { deptCacheKey } from './accessControl.js';

// Klíče cache se normalizují na DATUM (období je vždy zarovnané na dny), takže
// drobné rozdíly v ms mezi požadavky sdílí stejný záznam – a předehřátí cache
// (warm) trefí stejný klíč jako reálný požadavek z prohlížeče.
//
// `dept` může být string (jedno oddělení), string[] (manager s více odděleními)
// nebo undefined (žádné omezení). Pro stabilní cache klíč array vždy seřazený.
const d = (iso: string) => iso.slice(0, 10);
type Dept = string | string[] | undefined;
const k = (dept: Dept) => deptCacheKey(dept);

export const cq = {
  overview: (from: string, to: string, dept?: Dept) =>
    memo(`overview:${d(from)}:${d(to)}:${k(dept)}`, () => overview(new Date(from), new Date(to), dept)),
  scoreboard: (from: string, to: string, dept?: Dept) =>
    memo(`scoreboard:${d(from)}:${d(to)}:${k(dept)}`, () => scoreboardRows(new Date(from), new Date(to), dept)),
  monitors: (from: string, to: string, dept?: Dept) =>
    memo(`monitors:${d(from)}:${d(to)}:${k(dept)}`, () => monitorsComparison(new Date(from), new Date(to), dept)),
  software: (from: string, to: string, dept?: Dept) =>
    memo(`software:${d(from)}:${d(to)}:${k(dept)}`, () => softwareAudit(new Date(from), new Date(to), dept)),
  cost: (from: string, to: string, dept?: Dept) =>
    memo(`cost:${d(from)}:${d(to)}:${k(dept)}`, () => costAudit(new Date(from), new Date(to), dept)),
  homeoffice: (from: string, to: string, dept?: Dept) =>
    memo(`homeoffice:${d(from)}:${d(to)}:${k(dept)}`, () => homeOffice(new Date(from), new Date(to), dept)),
  trend: (from: string, to: string, userId?: string, dept?: Dept) =>
    memo(`trend:${d(from)}:${d(to)}:${userId ?? ''}:${k(dept)}`, () => trend(new Date(from), new Date(to), userId, dept)),
  topact: (from: string, to: string, userId?: string, dept?: Dept) =>
    memo(`topact:${d(from)}:${d(to)}:${userId ?? ''}:${k(dept)}`, () => topActivities(new Date(from), new Date(to), userId, dept)),
  selfreport: (userId: string, from: string, to: string) =>
    memo(`selfreport:${userId}:${d(from)}:${d(to)}`, () => selfReport(userId, new Date(from), new Date(to))),
};
