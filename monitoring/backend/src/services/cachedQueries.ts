import { memo } from './cache.js';
import { overview, monitorsComparison, softwareAudit, costAudit, homeOffice, selfReport, trend, topActivities } from './analytics.js';
import { scoreboardRows } from './scoring.js';

// Klíče cache se normalizují na DATUM (období je vždy zarovnané na dny), takže
// drobné rozdíly v ms mezi požadavky sdílí stejný záznam – a předehřátí cache
// (warm) trefí stejný klíč jako reálný požadavek z prohlížeče.
const d = (iso: string) => iso.slice(0, 10);

export const cq = {
  overview: (from: string, to: string, dept?: string) =>
    memo(`overview:${d(from)}:${d(to)}:${dept ?? ''}`, () => overview(new Date(from), new Date(to), dept)),
  scoreboard: (from: string, to: string, dept?: string) =>
    memo(`scoreboard:${d(from)}:${d(to)}:${dept ?? ''}`, () => scoreboardRows(new Date(from), new Date(to), dept)),
  monitors: (from: string, to: string, dept?: string) =>
    memo(`monitors:${d(from)}:${d(to)}:${dept ?? ''}`, () => monitorsComparison(new Date(from), new Date(to), dept)),
  software: (from: string, to: string, dept?: string) =>
    memo(`software:${d(from)}:${d(to)}:${dept ?? ''}`, () => softwareAudit(new Date(from), new Date(to), dept)),
  cost: (from: string, to: string, dept?: string) =>
    memo(`cost:${d(from)}:${d(to)}:${dept ?? ''}`, () => costAudit(new Date(from), new Date(to), dept)),
  homeoffice: (from: string, to: string, dept?: string) =>
    memo(`homeoffice:${d(from)}:${d(to)}:${dept ?? ''}`, () => homeOffice(new Date(from), new Date(to), dept)),
  trend: (from: string, to: string, userId?: string, dept?: string) =>
    memo(`trend:${d(from)}:${d(to)}:${userId ?? ''}:${dept ?? ''}`, () => trend(new Date(from), new Date(to), userId, dept)),
  topact: (from: string, to: string, userId?: string, dept?: string) =>
    memo(`topact:${d(from)}:${d(to)}:${userId ?? ''}:${dept ?? ''}`, () => topActivities(new Date(from), new Date(to), userId, dept)),
  selfreport: (userId: string, from: string, to: string) =>
    memo(`selfreport:${userId}:${d(from)}:${d(to)}`, () => selfReport(userId, new Date(from), new Date(to))),
};
