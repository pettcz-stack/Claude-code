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
