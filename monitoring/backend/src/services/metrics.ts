import { prisma } from '../db.js';

/**
 * Lehké aplikační metriky v Prometheus text format na `/api/v1/metrics`.
 *
 * Bez závislosti na prom-client – jednoduché čítače v paměti + dva live
 * dotazy do DB (devices online, total users). Prometheus / Grafana
 * je nascrapuje a vytvoří alerting / dashboardy.
 *
 * Limit: čítače se ztrácejí při restartu (typické pro counterové
 * metriky bez perzistentního exporteru). Pro long-term storage
 * použít skutečný Prometheus scrape interval 15–30 s.
 */

interface Counter {
  inc(by?: number): void;
  value(): number;
}

function counter(): Counter {
  let v = 0;
  return { inc: (by = 1) => { v += by; }, value: () => v };
}

// HTTP counters
export const httpRequests = counter();
export const httpErrors = counter();
export const ingestSuccess = counter();
export const ingestRejected = counter();
export const loginSuccess = counter();
export const loginFailed = counter();
export const accessAuditEvents = counter();

// Histogram (jen pro response time, jednoduchý počítadlový bucket).
const buckets = [10, 50, 100, 250, 500, 1000, 2500, 5000]; // ms
const responseTimeBuckets = buckets.map(() => 0);
let responseTimeSum = 0;
let responseTimeCount = 0;

export function observeResponseTime(ms: number): void {
  responseTimeSum += ms;
  responseTimeCount += 1;
  for (let i = 0; i < buckets.length; i++) {
    if (ms <= buckets[i]) responseTimeBuckets[i] += 1;
  }
}

export async function renderMetrics(): Promise<string> {
  const lines: string[] = [];

  // Active devices (sent ingest in last hour)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let activeDevices = 0;
  let totalUsers = 0;
  try {
    activeDevices = await prisma.device.count({ where: { lastSeen: { gte: hourAgo }, active: true } });
    totalUsers = await prisma.monitoredUser.count({ where: { active: true } });
  } catch { /* DB down – metriky nemají blokovat health */ }

  lines.push('# HELP focus_http_requests_total Total HTTP requests served');
  lines.push('# TYPE focus_http_requests_total counter');
  lines.push(`focus_http_requests_total ${httpRequests.value()}`);

  lines.push('# HELP focus_http_errors_total HTTP responses with status >= 400');
  lines.push('# TYPE focus_http_errors_total counter');
  lines.push(`focus_http_errors_total ${httpErrors.value()}`);

  lines.push('# HELP focus_ingest_success_total Ingest payloads accepted');
  lines.push('# TYPE focus_ingest_success_total counter');
  lines.push(`focus_ingest_success_total ${ingestSuccess.value()}`);

  lines.push('# HELP focus_ingest_rejected_total Ingest payloads rejected (bad token / payload)');
  lines.push('# TYPE focus_ingest_rejected_total counter');
  lines.push(`focus_ingest_rejected_total ${ingestRejected.value()}`);

  lines.push('# HELP focus_login_success_total Successful admin logins');
  lines.push('# TYPE focus_login_success_total counter');
  lines.push(`focus_login_success_total ${loginSuccess.value()}`);

  lines.push('# HELP focus_login_failed_total Failed admin login attempts');
  lines.push('# TYPE focus_login_failed_total counter');
  lines.push(`focus_login_failed_total ${loginFailed.value()}`);

  lines.push('# HELP focus_access_audit_events_total Number of access audit log entries created since restart');
  lines.push('# TYPE focus_access_audit_events_total counter');
  lines.push(`focus_access_audit_events_total ${accessAuditEvents.value()}`);

  lines.push('# HELP focus_devices_active Number of devices that reported data in the last hour');
  lines.push('# TYPE focus_devices_active gauge');
  lines.push(`focus_devices_active ${activeDevices}`);

  lines.push('# HELP focus_users_total Number of active monitored users');
  lines.push('# TYPE focus_users_total gauge');
  lines.push(`focus_users_total ${totalUsers}`);

  lines.push('# HELP focus_http_response_time_ms HTTP response time histogram (milliseconds)');
  lines.push('# TYPE focus_http_response_time_ms histogram');
  let cumulative = 0;
  for (let i = 0; i < buckets.length; i++) {
    cumulative += responseTimeBuckets[i]; // bucket is "<=" so cumulative is correct
    lines.push(`focus_http_response_time_ms_bucket{le="${buckets[i]}"} ${cumulative}`);
  }
  lines.push(`focus_http_response_time_ms_bucket{le="+Inf"} ${responseTimeCount}`);
  lines.push(`focus_http_response_time_ms_sum ${responseTimeSum}`);
  lines.push(`focus_http_response_time_ms_count ${responseTimeCount}`);

  return lines.join('\n') + '\n';
}
