// Simulátor agenta: posílá realistické dávky intervalů na /api/v1/ingest.
// Umožní vyzkoušet celý řetězec (ingest → agregace → dashboard) bez Windows.
//
// Použití:
//   WORKVIEW_BACKEND_URL=http://localhost:4000 INGEST_TOKEN=dev-token \
//   tsx src/bin/simulate-agent.ts --machine SIM-PC-1 --sid S-1-5-21-SIM-1 --minutes 120

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i]?.replace(/^--/, '');
  if (k) args.set(k, process.argv[i + 1] ?? '');
}

const backend = (process.env.WORKVIEW_BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const token = process.env.INGEST_TOKEN ?? 'dev-token';
const machineId = args.get('machine') ?? 'SIM-PC-1';
const sid = args.get('sid') ?? 'S-1-5-21-SIM-1';
const minutes = Number(args.get('minutes') ?? 120);
const monitors = Number(args.get('monitors') ?? 2);
const clientIp = args.get('ip') ?? '10.20.5.42'; // odpovídá demo podsíti „Pobočka Praha" (10.20.0.0/16)

const APPS = ['winword.exe', 'excel.exe', 'chrome.exe', 'outlook.exe', 'teams.exe', 'code.exe'];

function buildIntervals(count: number) {
  const out = [];
  const start = new Date();
  start.setMinutes(start.getMinutes() - count, 0, 0);
  for (let i = 0; i < count; i++) {
    const t = new Date(start.getTime() + i * 60_000);
    const working = Math.random() > 0.2;
    const active = working ? 50 + Math.floor(Math.random() * 10) : Math.floor(Math.random() * 15);
    out.push({
      intervalStart: t.toISOString(),
      intervalSeconds: 60,
      activeSeconds: active,
      idleSeconds: 60 - active,
      foregroundApp: APPS[Math.floor(Math.random() * APPS.length)],
      keystrokeCount: working ? Math.floor(Math.random() * 250) : 0,
      mouseEvents: working ? Math.floor(Math.random() * 120) : 0,
      sessionLocked: !working && Math.random() > 0.8,
      monitorCount: monitors,
      clientIp,
    });
  }
  return out;
}

async function main() {
  const payload = {
    device: { machineId, hostname: machineId.toLowerCase(), os: 'Windows 11 (sim)', agentVersion: 'sim-0.1.0' },
    user: { sid, displayName: `Simulace ${sid.slice(-1)}`, department: 'Test' },
    intervals: buildIntervals(minutes),
  };

  const res = await fetch(`${backend}/api/v1/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  // eslint-disable-next-line no-console
  console.log(`HTTP ${res.status}: ${body}`);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
