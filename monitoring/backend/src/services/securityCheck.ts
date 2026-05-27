import { prisma } from '../db.js';
import { config } from '../config.js';

export interface CheckResult {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  remediation?: string;
}

/**
 * Spočítá rychlý self-audit checklist pro běžícího serveru. Vrací seznam
 * položek, které admin uvidí v Settings → Bezpečnostní self-audit.
 * Cíl: aby admin do 30 sekund věděl, jestli má instalaci dobře utaženou.
 *
 * Žádný z těchto checků nepotřebuje internet ani externí dependency.
 */
export async function runSecurityCheck(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  // 1. NODE_ENV
  out.push({
    id: 'node_env',
    title: 'NODE_ENV=production',
    status: config.nodeEnv === 'production' ? 'pass' : 'warn',
    detail: `Aktuální: ${config.nodeEnv}`,
    remediation: config.nodeEnv === 'production' ? undefined : 'V produkci nastav NODE_ENV=production – aktivuje HTTPS-only cookie + HSTS + fail-fast secrets.',
  });

  // 2. INGEST_TOKEN síla
  const tokenLen = config.ingestToken.length;
  const weakTokens = ['dev-token', '', 'token', '__set_before_first_run__'];
  const isWeak = weakTokens.includes(config.ingestToken.toLowerCase());
  out.push({
    id: 'ingest_token',
    title: 'INGEST_TOKEN je silný',
    status: isWeak ? 'fail' : tokenLen >= 24 ? 'pass' : 'warn',
    detail: isWeak ? 'Používáš výchozí / placeholder hodnotu!' : `Délka ${tokenLen} znaků`,
    remediation: isWeak || tokenLen < 24 ? 'Vygeneruj nový: openssl rand -hex 32 a restartuj backend.' : undefined,
  });

  // 3. Per-device tokeny (kolik zařízení už je enrolled vs ne)
  const total = await prisma.device.count({ where: { active: true } });
  const enrolled = await prisma.device.count({ where: { active: true, enrollmentTokenHash: { not: null } } });
  const ratio = total > 0 ? enrolled / total : 1;
  out.push({
    id: 'per_device_tokens',
    title: 'Per-device enrollment tokeny',
    status: total === 0 ? 'pass' : ratio === 1 ? 'pass' : ratio >= 0.8 ? 'warn' : 'fail',
    detail: `${enrolled}/${total} zařízení má per-device token`,
    remediation: ratio < 1 ? 'Starší agenti se enrollnou sami při příští komunikaci. Po 7 dnech přestane sdílený INGEST_TOKEN fungovat pro /ingest (v0.4).' : undefined,
  });

  // 4. Demo data v produkci
  const demoDevices = await prisma.device.count({ where: { machineId: { startsWith: 'DEMO-PC-' } } });
  out.push({
    id: 'demo_data',
    title: 'Demo data jsou pryč',
    status: demoDevices === 0 ? 'pass' : config.nodeEnv === 'production' ? 'fail' : 'warn',
    detail: demoDevices === 0 ? 'Žádná DEMO-PC-* zařízení v DB.' : `${demoDevices} demo zařízení v DB`,
    remediation: demoDevices > 0 ? 'V produkci smaž demo zařízení: prisma.device.deleteMany({where:{machineId:{startsWith:"DEMO-PC-"}}}).' : undefined,
  });

  // 5. Retence v UI nastavená rozumně
  const settings = await prisma.setting.findUnique({ where: { key: 'retentionDaysIntervals' } });
  const ret = settings ? Number(settings.value) : config.rawRetentionDays;
  out.push({
    id: 'retention',
    title: 'Retenční politika je nastavená',
    status: ret >= 30 && ret <= 1825 ? 'pass' : 'warn',
    detail: `Surové intervaly se mažou po ${ret} dnech`,
    remediation: ret > 1825 ? 'Přes 5 let je hodně – zvaž zkrácení (GDPR čl. 5/1/e – omezené uchování).' : ret < 30 ? 'Pod měsíc je krátké pro doložení docházky.' : undefined,
  });

  // 6. Self-audit zaměstnance zapnut
  const auditSetting = await prisma.setting.findUnique({ where: { key: 'selfAuditEnabled' } });
  const auditOn = auditSetting?.value === 'true';
  out.push({
    id: 'self_audit',
    title: 'Zaměstnanec vidí kdo se na něj díval',
    status: auditOn ? 'pass' : 'warn',
    detail: auditOn ? 'Zapnuto – transparentnost dle GDPR čl. 32.' : 'Vypnuto',
    remediation: auditOn ? undefined : 'Zapni v Nastavení → "Zaměstnanec vidí kdo se na jeho data díval" – plní transparentnostní povinnost a zvyšuje důvěru.',
  });

  // 7. Aktivní admin sessions
  const activeSessions = await prisma.adminSession.count({ where: { expiresAt: { gt: new Date() } } });
  out.push({
    id: 'admin_sessions',
    title: 'Aktivní admin sessions',
    status: activeSessions <= 10 ? 'pass' : 'warn',
    detail: `${activeSessions} aktivních session`,
    remediation: activeSessions > 10 ? 'Hodně paralelních session – zvaž revokaci nepoužívaných (Settings → Sessions, roadmap).' : undefined,
  });

  // 8a. Tisk / USB monitoring – GDPR varování pro „capture" toggles
  const settingsAll = await prisma.setting.findMany({ where: { key: { in: ['printTrackingEnabled', 'capturePrintDocName', 'usbTrackingEnabled', 'captureUsbFilename'] } } });
  const ssMap = new Map(settingsAll.map((s) => [s.key, s.value === 'true']));
  if (ssMap.get('capturePrintDocName')) {
    out.push({
      id: 'print_doc_names',
      title: 'Sběr názvů tištěných dokumentů je ZAPNUTÝ',
      status: 'warn',
      detail: 'Názvy dokumentů mohou obsahovat citlivé údaje (zdravotní zpráva, mzdové podklady, soukromý dopis).',
      remediation: 'Ujisti se, že zaměstnanci jsou o tomto sběru explicitně poučeni (§ 316/3 ZP) a že je proveden balanční test + DPIA. Pro nižší riziko vypni a ukládej jen počty stran.',
    });
  }
  if (ssMap.get('captureUsbFilename')) {
    out.push({
      id: 'usb_filenames',
      title: 'Sběr názvů USB souborů je ZAPNUTÝ',
      status: 'warn',
      detail: 'Názvy souborů mohou obsahovat citlivé údaje.',
      remediation: 'Stejně jako u tisku – ověř, že je krytý v poučení a DPIA. Pro DLP detekci ve většině případů stačí sledovat jen velikosti a typy souborů.',
    });
  }

  // 8b. Audit log retence
  const auditCount = await prisma.accessAudit.count();
  const auditOld = await prisma.accessAudit.findFirst({ orderBy: { createdAt: 'asc' } });
  const auditDays = auditOld ? Math.floor((Date.now() - auditOld.createdAt.getTime()) / 86400000) : 0;
  out.push({
    id: 'audit_log',
    title: 'Audit přístupů funguje',
    status: auditCount > 0 ? 'pass' : 'warn',
    detail: `${auditCount} záznamů, nejstarší ${auditDays} dní zpět`,
    remediation: auditCount === 0 ? 'Žádný admin se ještě nedíval na data zaměstnance – buď nikdo nepoužívá dashboard, nebo audit nelogguje. Otevři něčí detail a zkontroluj.' : undefined,
  });

  return out;
}
