import nodemailer from 'nodemailer';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { minutesLabel } from '../util.js';
import { floorToDay, addDays, dayKey } from './tz.js';

type ReportRow = {
  displayName: string;
  department: string;
  activeMinutes: number;
  idleMinutes: number;
  avgKpm: number;
};

/** Sestaví souhrn aktivity za zadané období (agregace hodinových řádků na uživatele). */
export async function buildReportRows(from: Date, to: Date): Promise<ReportRow[]> {
  const users = await prisma.monitoredUser.findMany({
    where: { active: true },
    select: { id: true, displayName: true, department: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const hourly = await prisma.activityHourly.findMany({
    where: { userId: { in: users.map((u) => u.id) }, hourStart: { gte: from, lt: to } },
  });

  const acc = new Map<string, { active: number; idle: number; ks: number }>();
  for (const h of hourly) {
    const a = acc.get(h.userId) ?? { active: 0, idle: 0, ks: 0 };
    a.active += h.activeMinutes;
    a.idle += h.idleMinutes;
    a.ks += h.keystrokeTotal;
    acc.set(h.userId, a);
  }

  const rows: ReportRow[] = [];
  for (const [userId, a] of acc) {
    const u = userMap.get(userId);
    rows.push({
      displayName: u?.displayName ?? userId,
      department: u?.department ?? '',
      activeMinutes: Math.round(a.active),
      idleMinutes: Math.round(a.idle),
      avgKpm: a.active > 0 ? Math.round(a.ks / a.active) : 0,
    });
  }
  rows.sort((x, y) => y.activeMinutes - x.activeMinutes);
  return rows;
}

function renderHtml(rows: ReportRow[], from: Date, to: Date): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.displayName)}</td><td>${escapeHtml(r.department)}</td>` +
        `<td align="right">${minutesLabel(r.activeMinutes)}</td>` +
        `<td align="right">${minutesLabel(r.idleMinutes)}</td>` +
        `<td align="right">${r.avgKpm}</td></tr>`,
    )
    .join('');
  return `
    <h2>WorkView – souhrn aktivity</h2>
    <p>Období: ${dayKey(from)} – ${dayKey(to)}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
      <thead style="background:#f3f4f6">
        <tr><th align="left">Zaměstnanec</th><th align="left">Oddělení</th><th>Aktivní</th><th>Nečinnost</th><th>Úhozy/min</th></tr>
      </thead>
      <tbody>${body || '<tr><td colspan="5">Žádná data</td></tr>'}</tbody>
    </table>
    <p style="color:#6b7280;font-size:12px">Pouze agregovaná data o využití firemních zařízení (§316 ZP).</p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Sestaví a odešle report za posledních `rangeDays` (do začátku dnešního místního dne). */
export async function sendReport(): Promise<{ recipients: number; rows: number }> {
  const to = floorToDay(new Date());
  const from = addDays(to, -config.report.rangeDays);

  const rows = await buildReportRows(from, to);

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to: config.report.recipients.join(','),
    subject: `WorkView souhrn ${dayKey(from)} – ${dayKey(to)}`,
    html: renderHtml(rows, from, to),
  });

  return { recipients: config.report.recipients.length, rows: rows.length };
}
