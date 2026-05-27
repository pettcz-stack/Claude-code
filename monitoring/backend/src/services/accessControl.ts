import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

export type Role = 'ADMIN' | 'MANAGER' | 'IT' | 'VIEWER';

/**
 * Pravidla viditelnosti tabů a sekcí podle role.
 * Klient si je natáhne přes GET /api/v1/me/access a podle toho schová tabulky.
 * Backend stejnou matrix vynucuje na úrovni endpointů (defense in depth).
 */
export const ROLE_CAPABILITIES: Record<Role, {
  // Top-level taby
  overview: boolean;
  scoreboard: boolean;
  trends: boolean;
  alerts: boolean;
  detail: boolean;
  selfreport: boolean;
  homeoffice: boolean;
  calendar: boolean;
  software: boolean;
  apps: boolean;
  summary: boolean;
  health: boolean;
  printusb: boolean;
  admin: boolean;     // záložka "Správa" (klasifikace, audit, atd.)
  access: boolean;    // záložka "Přístupy" (správa rolí jiných adminů)
  settings: boolean;
  // Akce
  canSeeSalaries: boolean;           // hourlyRate v UI
  canSeeIndividualActivity: boolean; // detail produktivity konkrétního zaměstnance
  restrictedToDepartments: boolean;  // filtrovat výstupy podle MonitoredUser.department
}> = {
  ADMIN: {
    overview: true, scoreboard: true, trends: true, alerts: true,
    detail: true, selfreport: true, homeoffice: true, calendar: true,
    software: true, apps: true, summary: true, health: true, printusb: true,
    admin: true, access: true, settings: true,
    canSeeSalaries: true, canSeeIndividualActivity: true, restrictedToDepartments: false,
  },
  MANAGER: {
    overview: true, scoreboard: true, trends: true, alerts: true,
    detail: true, selfreport: true, homeoffice: true, calendar: true,
    software: true, apps: false, summary: true, health: false, printusb: false,
    admin: false, access: false, settings: false,
    canSeeSalaries: false, canSeeIndividualActivity: true, restrictedToDepartments: true,
  },
  IT: {
    overview: false, scoreboard: false, trends: false, alerts: true,
    detail: false, selfreport: false, homeoffice: false, calendar: false,
    software: true, apps: false, summary: false, health: true, printusb: true,
    admin: false, access: false, settings: false,
    canSeeSalaries: false, canSeeIndividualActivity: false, restrictedToDepartments: false,
  },
  VIEWER: {
    overview: true, scoreboard: true, trends: true, alerts: true,
    detail: true, selfreport: true, homeoffice: true, calendar: true,
    software: true, apps: true, summary: true, health: true, printusb: true,
    admin: false, access: false, settings: false,
    canSeeSalaries: false, canSeeIndividualActivity: true, restrictedToDepartments: false,
  },
};

/**
 * Najde oddělení, ke kterým má daný admin přístup. Pro MANAGER vrátí seznam
 * z tabulky AdminUserDepartment. Pro ostatní role vrátí null = bez restrikce.
 */
export async function allowedDepartments(adminId: string, role: Role): Promise<string[] | null> {
  if (role !== 'MANAGER') return null;
  const rows = await prisma.adminUserDepartment.findMany({
    where: { adminId },
    select: { department: true },
  });
  return rows.map((r) => r.department);
}

/** Middleware – vyžaduje, aby přihlášený admin měl jednu z uvedených rolí. */
export function requireOneOfRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) { res.status(401).json({ error: 'unauthorized' }); return; }
    if (!roles.includes(req.admin.role as Role)) {
      res.status(403).json({ error: 'forbidden', requiredRole: roles });
      return;
    }
    next();
  };
}

/** Středisko schopností – vrací pravidla viditelnosti dle role. */
export function capabilities(role: string) {
  return ROLE_CAPABILITIES[(role as Role)] ?? ROLE_CAPABILITIES.VIEWER;
}

/**
 * Rozsah oddělení, která daný admin smí vidět.
 *  - `unrestricted` = ADMIN/IT/VIEWER, vidí všechna oddělení.
 *  - `allowed` = MANAGER, vidí pouze tato (může být prázdné = nic nevidí).
 */
export type DeptScope =
  | { unrestricted: true }
  | { unrestricted: false; allowed: string[] };

/** Vrátí rozsah oddělení pro req.admin. Cache neukládá – levné. */
export async function getDeptScope(req: Request): Promise<DeptScope> {
  const role = (req.admin?.role ?? 'VIEWER') as Role;
  if (role !== 'MANAGER') return { unrestricted: true };
  const allowed = (await allowedDepartments(req.admin!.id, role)) ?? [];
  return { unrestricted: false, allowed };
}

/**
 * Vyhodnotí query parametr `?department=` proti scope přihlášeného uživatele.
 *
 *  - ADMIN/IT/VIEWER: vrátí přesně to, co přišlo (nebo undefined).
 *  - MANAGER bez přiřazených oddělení: 403, vrátí null.
 *  - MANAGER s `?department=X`: pokud X není v allowed → 403, vrátí null.
 *  - MANAGER bez `?department`: vrátí array všech allowed (multi-dept agregace).
 *
 * Volající MUSÍ zkontrolovat `=== null` a v takovém případě skončit – response
 * už je odeslaná. Jinak filter předá do cq.* / analytics.*.
 */
export async function resolveDept(
  req: Request,
  res: Response,
  requested?: string,
): Promise<string | string[] | undefined | null> {
  const scope = await getDeptScope(req);
  if (scope.unrestricted) return requested;
  if (scope.allowed.length === 0) {
    res.status(403).json({ error: 'no_departments_assigned' });
    return null;
  }
  if (requested) {
    if (!scope.allowed.includes(requested)) {
      res.status(403).json({ error: 'department_not_allowed', requested });
      return null;
    }
    return requested;
  }
  // Manager má více oddělení a žádné konkrétní nepožádal → agregovat přes všechna.
  return scope.allowed.length === 1 ? scope.allowed[0] : scope.allowed;
}

/**
 * Ověří, že přihlášený admin smí vidět daného MonitoredUser.
 *  - ADMIN/IT/VIEWER: vždy true.
 *  - MANAGER: true pouze pokud user.department ∈ allowed.
 *
 * Pokud false, odešle 403 a vrátí false – volající skončí.
 */
export async function assertCanSeeUser(
  req: Request,
  res: Response,
  userId: string,
): Promise<boolean> {
  const scope = await getDeptScope(req);
  if (scope.unrestricted) return true;
  const u = await prisma.monitoredUser.findUnique({
    where: { id: userId },
    select: { department: true },
  });
  if (!u || !u.department || !scope.allowed.includes(u.department)) {
    res.status(403).json({ error: 'user_not_in_allowed_departments' });
    return false;
  }
  return true;
}

/**
 * Vrátí Prisma `where` fragment pro filtraci podle oddělení.
 *  - undefined / null → {} (žádný filter)
 *  - string → { department: 'Sales' }
 *  - string[] → { department: { in: [...] } } (Prisma vrátí prázdno pro [])
 */
export function deptWhere(
  dept?: string | string[] | null,
): { department?: string | { in: string[] } } {
  if (dept === undefined || dept === null) return {};
  if (Array.isArray(dept)) return { department: { in: dept } };
  return { department: dept };
}

/** Stabilní string klíč pro cache (sjednotí pořadí array). */
export function deptCacheKey(dept?: string | string[] | null): string {
  if (!dept) return '';
  if (Array.isArray(dept)) return dept.slice().sort().join('|');
  return dept;
}
