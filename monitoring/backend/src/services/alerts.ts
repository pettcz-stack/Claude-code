import { prisma } from '../db.js';
import { config } from '../config.js';
import { getSettings } from './settings.js';
import { demoUserWhere, demoDeviceWhere } from './demoFilter.js';
import { computeIntegrity } from './integrity.js';
import { sendMail, escapeHtml } from './mailer.js';

const LABELS: Record<string, string> = {
  MOUSE_JIGGLER: 'Simulátor myši',
  KEYBOARD_WEIGHT: 'Předmět na klávesnici / simulátor kláves',
  NO_APP_SWITCH: 'Bez přepínání aplikací',
  ROBOTIC_REGULARITY: 'Roboticky pravidelný vzor',
};

/** Vrátí true a zapíše odeslání, pokud klíč nebyl odeslán v rámci cooldownu. */
async function shouldSend(key: string, cooldownMs: number): Promise<boolean> {
  const existing = await prisma.sentAlert.findUnique({ where: { key } });
  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < cooldownMs) return false;
  await prisma.sentAlert.upsert({ where: { key }, create: { key, lastSentAt: new Date() }, update: { lastSentAt: new Date() } });
  return true;
}

async function clearAlert(key: string): Promise<void> {
  await prisma.sentAlert.deleteMany({ where: { key } });
}

/** Pomocný překlad detail kódů do češtiny pro e-mailové notifikace.
 *  E-mail = server-side, žádné i18n hooks. Pro produkční nasazení v jiném
 *  jazyce by se přidal locale setting v alerts settings (out of scope teď). */
function detailToCzech(code: string, params?: Record<string, number | string>): string {
  const p = params ?? {};
  switch (code) {
    case 'MOUSE_JIGGLER_DETAIL':
      return 'Dlouhodobý pohyb myši bez jediného úhozu klávesnice a bez přepínání aplikací — pravděpodobně použitý simulátor pohybu myši.';
    case 'KEYBOARD_WEIGHT_DETAIL':
      return 'Trvalé psaní s nepřirozeně pravidelným rytmem, bez používání myši a beze změny aktivní aplikace.';
    case 'NO_APP_SWITCH_DETAIL':
      return `Více než ${p.hours ?? '?'} h souvislé aktivity v jedné aplikaci bez jediného přepnutí.`;
    case 'ROBOTIC_REGULARITY_DETAIL':
      return 'Aktivita má strojově pravidelný vzor — téměř identické hodnoty po dlouhou dobu.';
    case 'EVASION_SOFTWARE_DETAIL':
      return `Použití programu pro obcházení sledování (${p.minutes ?? '?'} min): ${p.apps ?? ''}${Number(p.more) > 0 ? ' a další' : ''}.`;
    case 'AFTER_HOURS_ACTIVITY_DETAIL':
      return `Aktivita mimo pracovní dobu: ${p.nights ?? '?'} nocí, celkem ${p.minutes ?? '?'} min po 21:00.`;
    default:
      return code;
  }
}

function isWorkHours(d = new Date()): boolean {
  const dow = d.getDay();
  const h = d.getHours();
  return dow >= 1 && dow <= 5 && h >= 8 && h < 16;
}

export type AlertRunResult = { integritySent: number; offlineSent: number; skipped?: string };

/** Zkontroluje pirátské praktiky a výpadky agentů a odešle e-maily (s anti-spamem). */
export async function runAlertChecks(): Promise<AlertRunResult> {
  const settings = await getSettings();
  if (!settings.alertsEnabled) return { integritySent: 0, offlineSent: 0, skipped: 'alerts_disabled' };
  if (config.smtp.host.length === 0) return { integritySent: 0, offlineSent: 0, skipped: 'no_smtp' };
  const to = settings.alertRecipients;
  if (to.length === 0) return { integritySent: 0, offlineSent: 0, skipped: 'no_recipients' };

  let integritySent = 0;
  let offlineSent = 0;

  // 1) Pirátské praktiky – okno posledních 72 h
  const to72 = new Date();
  const from72 = new Date(to72.getTime() - 72 * 60 * 60 * 1000);
  const users = await prisma.monitoredUser.findMany({ where: { active: true, ...(await demoUserWhere()) }, select: { id: true, displayName: true, department: true } });
  for (const u of users) {
    const r = await computeIntegrity(u.id, from72, to72);
    if (!r.suspicious) {
      await clearAlert('integrity:' + u.id);
      continue;
    }
    if (await shouldSend('integrity:' + u.id, 24 * 60 * 60 * 1000)) {
      const flags = r.flags.map((f) => `<li><b>${escapeHtml(LABELS[f.type] ?? f.type)}</b> (${f.severity}) – ${escapeHtml(detailToCzech(f.detailCode, f.detailParams))}</li>`).join('');
      await sendMail(
        to,
        `[Monitoring] Podezření na nepovolené praktiky – ${u.displayName ?? u.id}`,
        `<h3>Podezření na obcházení monitoringu</h3>
         <p>Zaměstnanec: <b>${escapeHtml(u.displayName ?? u.id)}</b> (${escapeHtml(u.department ?? '')})<br/>
         Míra rizika: <b>${r.riskScore}/100</b></p>
         <ul>${flags}</ul>
         <p style="color:#6b7280;font-size:12px">Automatické upozornění. Doporučeno prověřit.</p>`,
      );
      integritySent++;
    }
  }

  // 2) Výpadek agenta – jen v pracovní době, ať nehlásíme noci/víkendy
  if (isWorkHours()) {
    const cutoff = new Date(Date.now() - settings.offlineMinutes * 60 * 1000);
    const devices = await prisma.device.findMany({ where: { active: true, ...(await demoDeviceWhere()) }, select: { id: true, hostname: true, lastSeen: true } });
    for (const d of devices) {
      const offline = !d.lastSeen || new Date(d.lastSeen) < cutoff;
      if (!offline) {
        await clearAlert('offline:' + d.id);
        continue;
      }
      if (await shouldSend('offline:' + d.id, 6 * 60 * 60 * 1000)) {
        await sendMail(
          to,
          `[Monitoring] Agent neodesílá data – ${d.hostname}`,
          `<h3>Agent je nedostupný</h3>
           <p>Zařízení: <b>${escapeHtml(d.hostname)}</b><br/>
           Poslední kontakt: ${d.lastSeen ? new Date(d.lastSeen).toLocaleString('cs-CZ') : 'nikdy'}</p>
           <p style="color:#6b7280;font-size:12px">Možný výpadek, vypnuté PC, nebo pokus o obcházení monitoringu.</p>`,
        );
        offlineSent++;
      }
    }
  }

  return { integritySent, offlineSent };
}
