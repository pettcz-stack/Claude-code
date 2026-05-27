import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireOneOfRoles } from '../services/accessControl.js';
import { hashPassword, logAccess } from '../auth.js';

/**
 * Správa přístupů (admin účtů + jejich rolí + povolených oddělení).
 * Všechny endpointy vyžadují roli ADMIN.
 */
export const accessRouter = Router();

// Jen ADMIN smí spravovat účty.
accessRouter.use(requireOneOfRoles('ADMIN'));

const ROLES = ['ADMIN', 'MANAGER', 'IT', 'VIEWER'] as const;

/** Seznam všech admin účtů s jejich rolí a přiřazenými odděleními. */
accessRouter.get('/users', async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    orderBy: [{ active: 'desc' }, { username: 'asc' }],
    select: {
      id: true, username: true, role: true, fullName: true, email: true, active: true,
      createdAt: true, updatedAt: true,
      departments: { select: { department: true } },
    },
  });
  res.json({
    users: users.map((u) => ({ ...u, departments: u.departments.map((d) => d.department) })),
  });
});

/** Seznam unikátních oddělení (z MonitoredUser.department) – pro UI dropdown. */
accessRouter.get('/departments', async (_req, res) => {
  const rows = await prisma.monitoredUser.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ['department'],
    orderBy: { department: 'asc' },
  });
  res.json({ departments: rows.map((r) => r.department).filter((d): d is string => !!d) });
});

const createSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'invalid_chars'),
  password: z.string().min(10).max(200),
  role: z.enum(ROLES),
  fullName: z.string().max(120).optional(),
  email: z.string().email().max(200).optional(),
  departments: z.array(z.string().min(1).max(120)).max(50).optional(),
});

accessRouter.post('/users', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_payload', detail: parsed.error.flatten() });
  const { username, password, role, fullName, email, departments } = parsed.data;
  // Check duplicate username
  const existing = await prisma.adminUser.findUnique({ where: { username }, select: { id: true } });
  if (existing) return void res.status(409).json({ error: 'username_exists' });

  const u = await prisma.adminUser.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      role,
      fullName: fullName ?? null,
      email: email ?? null,
    },
  });
  if (role === 'MANAGER' && departments && departments.length > 0) {
    await prisma.adminUserDepartment.createMany({
      data: departments.map((department) => ({ adminId: u.id, department })),
    });
  }
  await logAccess({
    adminId: req.admin?.id, adminIdentity: req.admin?.username ?? 'unknown',
    action: 'ACCESS_CREATE', detail: `vytvořen admin účet ${username} role=${role}`,
  });
  res.json({ ok: true, id: u.id });
});

const updateSchema = z.object({
  role: z.enum(ROLES).optional(),
  fullName: z.string().max(120).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  active: z.boolean().optional(),
  departments: z.array(z.string().min(1).max(120)).max(50).optional(),
  newPassword: z.string().min(10).max(200).optional(), // admin resetuje cizí heslo
});

accessRouter.patch('/users/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'invalid_payload', detail: parsed.error.flatten() });
  const u = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!u) return void res.status(404).json({ error: 'not_found' });

  const data: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.newPassword !== undefined) data.passwordHash = hashPassword(parsed.data.newPassword);

  await prisma.adminUser.update({ where: { id: u.id }, data });

  // Pokud se mění departments nebo role na MANAGER → přemapuj
  if (parsed.data.departments !== undefined || parsed.data.role === 'MANAGER') {
    const newDepts = parsed.data.departments ?? [];
    await prisma.adminUserDepartment.deleteMany({ where: { adminId: u.id } });
    if (newDepts.length > 0) {
      await prisma.adminUserDepartment.createMany({
        data: newDepts.map((department) => ({ adminId: u.id, department })),
      });
    }
  }

  // Při změně hesla zruš všechny existující session daného účtu (anti-takeover).
  if (parsed.data.newPassword !== undefined) {
    await prisma.adminSession.deleteMany({ where: { adminId: u.id } });
  }

  await logAccess({
    adminId: req.admin?.id, adminIdentity: req.admin?.username ?? 'unknown',
    action: 'ACCESS_UPDATE',
    detail: `aktualizován admin účet ${u.username}: ${JSON.stringify(Object.keys(parsed.data))}`,
  });
  res.json({ ok: true });
});

accessRouter.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.admin?.id) {
    return void res.status(400).json({ error: 'cannot_delete_self' });
  }
  const u = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!u) return void res.status(404).json({ error: 'not_found' });
  // Zachovej alespoň jednoho aktivního ADMINa
  if (u.role === 'ADMIN') {
    const activeAdmins = await prisma.adminUser.count({ where: { role: 'ADMIN', active: true } });
    if (activeAdmins <= 1) return void res.status(400).json({ error: 'last_admin' });
  }
  await prisma.adminUser.delete({ where: { id: u.id } });
  await prisma.adminSession.deleteMany({ where: { adminId: u.id } });
  await logAccess({
    adminId: req.admin?.id, adminIdentity: req.admin?.username ?? 'unknown',
    action: 'ACCESS_DELETE', detail: `smazán admin účet ${u.username}`,
  });
  res.json({ ok: true });
});
