export type User = { id: string; displayName: string | null; department: string | null; sid: string };

export type HourlyRow = {
  id: string;
  userId: string;
  hourStart: string;
  activeMinutes: number;
  idleMinutes: number;
  lockedMinutes: number;
  topApp: string | null;
  keystrokeTotal: number;
  mouseTotal: number;
  avgKpm: number;
  meetingMinutes: number;
  absenceType: string | null;
};

export type SummaryRow = {
  userId: string;
  displayName: string | null;
  department: string | null;
  activeMinutes: number;
  idleMinutes: number;
  lockedMinutes: number;
  keystrokeTotal: number;
  mouseTotal: number;
  avgKpm: number;
};

export type Device = {
  id: string;
  machineId: string;
  hostname: string;
  os: string | null;
  agentVersion: string | null;
  active: boolean;
  lastSeen: string | null;
  online: boolean;
};

export type AdminUserRow = {
  id: string;
  sid: string;
  displayName: string | null;
  department: string | null;
  active: boolean;
  hourlyRate: number | null;
};

export type AuditRow = {
  id: string;
  adminIdentity: string;
  viewedUserId: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

export type CategorySlice = { category: string; type: 'WORK' | 'NON_WORK' | 'NEUTRAL'; minutes: number };

export type UserScore = {
  userId: string;
  displayName: string | null;
  department: string | null;
  expectedMinutes: number;
  workMinutes: number;
  nonWorkMinutes: number;
  idleOnMinutes: number;
  pcOffMinutes: number;
  meetingMinutes: number;
  workPct: number;
  nonWorkPct: number;
  idlePct: number;
  pcOffPct: number;
  score: number;
  avgKpm: number;
  kpmPercentile: number;
  categories: CategorySlice[];
  topApp: string | null;
  monitorTypical: number;
  multiMonitorPct: number;
  keystrokeTotal: number;
  appSwitchesPerHour: number;
  scoreRaw: number;
  monitorAdjusted: boolean;
  vacationDays: number;
  sickDays: number;
  holidayDays: number;
  siteDays: { site: string; days: number }[];
};
export type SoftwareItem = {
  app: string; category: string | null; type: string; activeHours: number; users: number; usersPct: number;
  licensed: boolean; seats: number | null; costPerSeat: number | null;
  utilizationPct: number | null; wasteSeats: number | null; wasteCost: number | null;
};
export type SoftwareAudit = { workforce: number; totalWasteCost: number; items: SoftwareItem[] };

export type MonitorAdvice = {
  userId: string;
  displayName: string | null;
  department: string | null;
  monitors: number;
  dominantCategory: string;
  activeHours: number;
  reclaimHoursLow: number;
  reclaimHoursHigh: number;
};
export type MonitorsData = {
  single: { users: number; avgScore: number; avgActiveHours: number };
  multi: { users: number; avgScore: number; avgActiveHours: number };
  perUser: { userId: string; displayName: string | null; department: string | null; monitors: number; score: number }[];
  advice: { upliftLowPct: number; upliftHighPct: number; candidates: MonitorAdvice[] };
};

export type ScoreboardRow = {
  userId: string;
  displayName: string | null;
  department: string | null;
  score: number;
  scoreRaw: number;
  monitorAdjusted: boolean;
  workPct: number;
  nonWorkPct: number;
  idlePct: number;
  pcOffPct: number;
  avgKpm: number;
};

export type TrendPoint = { date: string; score: number; workMinutes: number; nonWorkMinutes: number; idleMinutes: number; absence?: string | null };
export type ActivityItem = { label: string; category: string; type: 'WORK' | 'NON_WORK' | 'NEUTRAL'; minutes: number };
export type AppCategoryRow = { id: string; appName: string; category: string; type: string };
export type WebRuleRow = { id: string; keyword: string; category: string; type: string };
export type DeptRuleRow = { id: string; department: string; category: string; type: string };
export type HealthStatus = 'OK' | 'WARN' | 'CRITICAL' | 'UNREPORTED';
export type DiskInfo = { name: string; totalGB?: number; freeGB?: number; smartStatus?: string; reallocSectors?: number; pendingSectors?: number; powerOnHours?: number; tempC?: number };
export type DeviceHealthRow = {
  deviceId: string; hostname: string; machineId: string;
  primaryUser: string | null; primaryDepartment: string | null;
  reportedAt: string | null; lastSeen: string | null;
  status: HealthStatus; issues: string[];
  osName: string | null; manufacturer: string | null; model: string | null;
  batteryHealthPct: number | null; ramUsedPct: number | null; diskTopUsedPct: number | null;
  pendingUpdates: number | null; antivirusEnabled: boolean | null;
};
export type DeviceHealthDetail = DeviceHealthRow & {
  osVersion: string | null; uptimeSec: number | null; serial: string | null;
  biosVersion: string | null; biosDate: string | null;
  cpuModel: string | null; cpuLoadPct: number | null;
  ramTotalMB: number | null; batteryPresent: boolean;
  batteryChargePct: number | null; batteryCycles: number | null; onAcPower: boolean | null;
  disks: DiskInfo[]; antivirusUpdated: boolean | null; rebootPending: boolean | null;
};
export type CostResult = {
  workforce: number; withRate: number;
  totals: { nonworkCost: number; idleCost: number; pcoffCost: number; wastedCost: number };
  perUser: { userId: string; displayName: string | null; department: string | null; hourlyRate: number | null; nonworkHours: number; idleHours: number; pcoffHours: number; wastedCost: number | null }[];
};
export type ClaimRow = { id: string; userId: string; target: string; targetKind: string; suggested: string; note: string | null; status: string; createdAt: string };

export type IntegrityFlag = { type: string; severity: 'high' | 'medium'; detail: string; affectedMinutes: number };
export type IntegrityResult = { userId: string; riskScore: number; suspicious: boolean; flags: IntegrityFlag[] };
export type AlertItem = { userId: string; displayName: string | null; department: string | null; riskScore: number; suspicious: boolean; flags: IntegrityFlag[] };

export type Overview = {
  kpi: { userCount: number; avgScore: number; avgScoreDelta: number | null; activeHours: number; nonWorkHours: number; idleHours: number; nonWorkPct: number; flaggedCount: number; onlineCount: number };
  split: { work: number; nonwork: number; idle: number; pcoff: number };
  departments: { department: string; avgScore: number; activeHours: number; nonWorkPct: number; users: number }[];
  top: { userId: string; displayName: string | null; department: string | null; score: number }[];
  bottom: { userId: string; displayName: string | null; department: string | null; score: number }[];
  locations: { site: string; users: number }[];
};
export type Site = { id: string; name: string; subnets: string; kind: string; active: boolean };
export type Heatmap = { matrix: number[][]; max: number };

export type HomeOffice = {
  company: { usersWithHo: number; hoDays: number; officeDays: number; hoScore: number; officeScore: number; hoActiveHours: number; officeActiveHours: number; hoNonWorkPct: number; officeNonWorkPct: number };
  byDept: { department: string; hoScore: number; officeScore: number; hoDays: number }[];
  perUser: { userId: string; displayName: string | null; department: string | null; hoDays: number; hoScore: number; officeScore: number; diff: number }[];
};
export type SelfReportData = { displayName: string | null; department: string | null; score: number; companyPercentile: number; deptPercentile: number; kpmPercentile: number; avgKpm: number; activeHours: number; nonWorkPct: number; monitorTypical: number; multiMonitorPct: number; appSwitchesPerHour: number; keystrokeTotal: number; caloriesTyping: number; distanceMeters: number; currentSite: string; pcWorkPct: number; pcNonWorkPct: number; pcUnknownPct: number; focusSessions: number; focusMinutes: number; bestHourLabel: string | null; trendDeltaPct: number | null; lastWeekScore: number | null; priorWeekScore: number | null };

export type TipsData = {
  health: { category: string | null; text: string }[];
  growth: { text: string; author: string | null }[];
  fun: { text: string }[];
};

export type AppSettings = { alertsEnabled: boolean; alertRecipients: string[]; offlineMinutes: number; funMode: boolean; healthMode: boolean; growthMode: boolean; interpretMonitors: boolean; employeeReportEnabled: boolean; showDemoDevices: boolean; privacyStoreDomainOnly: boolean; retentionDaysIntervals: number; selfAuditEnabled: boolean };

export type Me = { username: string; role: string };

const STORAGE_KEY = 'focus_token';

export function getToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}
function setToken(t: string | null) {
  if (t) sessionStorage.setItem(STORAGE_KEY, t);
  else sessionStorage.removeItem(STORAGE_KEY);
}

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 401) {
    setToken(null);
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const auth = {
  async login(username: string, password: string): Promise<Me> {
    const res = await fetch('/api/v1/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Neplatné přihlašovací údaje');
    const data = (await res.json()) as { token: string; username: string; role: string };
    setToken(data.token);
    return { username: data.username, role: data.role };
  },
  logout() {
    const t = getToken();
    if (t) void fetch('/api/v1/logout', { method: 'POST', headers: { authorization: `Bearer ${t}` } });
    setToken(null);
  },
  me: () => getJson<Me>('/api/v1/me'),
  isLoggedIn: () => getToken() !== null,
};

export const api = {
  users: () => getJson<{ users: User[] }>('/api/v1/dashboard/users').then((d) => d.users),
  categories: () =>
    getJson<{ categories: Record<string, { category: string; type: string }> }>(
      '/api/v1/dashboard/categories',
    ).then((d) => d.categories),
  score: (userId: string, from: string, to: string) =>
    getJson<{ score: UserScore }>(
      `/api/v1/dashboard/score?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`,
    ).then((d) => d.score),
  scoreboard: (from: string, to: string, department?: string) =>
    getJson<{ rows: ScoreboardRow[] }>(
      `/api/v1/dashboard/scoreboard?from=${from}&to=${to}${department ? `&department=${encodeURIComponent(department)}` : ''}`,
    ).then((d) => d.rows),
  overview: (from: string, to: string, department?: string) => {
    const q = new URLSearchParams({ from, to });
    if (department) q.set('department', department);
    return getJson<Overview>(`/api/v1/dashboard/overview?${q}`);
  },
  heatmap: (from: string, to: string, opts: { userId?: string; department?: string } = {}) => {
    const q = new URLSearchParams({ from, to });
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.department) q.set('department', opts.department);
    return getJson<Heatmap>(`/api/v1/dashboard/heatmap?${q}`);
  },
  monitors: (from: string, to: string, department?: string) => {
    const q = new URLSearchParams({ from, to });
    if (department) q.set('department', department);
    return getJson<MonitorsData>(`/api/v1/dashboard/monitors?${q}`);
  },
  homeOffice: (from: string, to: string, department?: string) => {
    const q = new URLSearchParams({ from, to });
    if (department) q.set('department', department);
    return getJson<HomeOffice>(`/api/v1/dashboard/homeoffice?${q}`);
  },
  selfReport: (userId: string, from: string, to: string) =>
    getJson<{ report: SelfReportData }>(`/api/v1/dashboard/selfreport?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`).then((d) => d.report),
  tips: () => getJson<TipsData>('/api/v1/dashboard/tips'),
  selfReportPublic: (token: string, from: string, to: string) =>
    fetch(`/api/v1/self/report?token=${encodeURIComponent(token)}&from=${from}&to=${to}`).then(async (r) => {
      if (!r.ok) {
        let code: string | undefined;
        try { const j = await r.json(); code = typeof j?.error === 'string' ? j.error : undefined; } catch { /* nepodstatné */ }
        throw new Error(code ? `${r.status}:${code}` : `${r.status}`);
      }
      return r.json() as Promise<{ report: SelfReportData; tips: TipsData; modes: { funMode: boolean; healthMode: boolean; growthMode: boolean } }>;
    }),
  selfAudit: (token: string) =>
    fetch(`/api/v1/self/audit?token=${encodeURIComponent(token)}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json() as Promise<{ enabled: boolean; rows: { id: string; adminIdentity: string; action: string; detail: string | null; createdAt: string }[] }>;
    }),
  trend: (from: string, to: string, opts: { userId?: string; department?: string } = {}) => {
    const q = new URLSearchParams({ from, to });
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.department) q.set('department', opts.department);
    return getJson<{ points: TrendPoint[] }>(`/api/v1/dashboard/trend?${q}`).then((d) => d.points);
  },
  topActivities: (from: string, to: string, opts: { userId?: string; department?: string } = {}) => {
    const q = new URLSearchParams({ from, to });
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.department) q.set('department', opts.department);
    return getJson<{ apps: ActivityItem[]; sites: ActivityItem[] }>(`/api/v1/dashboard/top-activities?${q}`);
  },
  integrity: (userId: string, from: string, to: string) =>
    getJson<{ integrity: IntegrityResult }>(`/api/v1/dashboard/integrity?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`).then((d) => d.integrity),
  alerts: (from: string, to: string, department?: string) => {
    const q = new URLSearchParams({ from, to });
    if (department) q.set('department', department);
    return getJson<{ alerts: AlertItem[] }>(`/api/v1/dashboard/alerts?${q}`).then((d) => d.alerts);
  },
  // Správa kategorií a pravidel
  adminCategories: () => getJson<{ categories: AppCategoryRow[] }>('/api/v1/admin/categories').then((d) => d.categories),
  software: (from: string, to: string, department?: string) => {
    const q = new URLSearchParams({ from, to });
    if (department) q.set('department', department);
    return getJson<SoftwareAudit>(`/api/v1/dashboard/software?${q}`);
  },
  cost: (from: string, to: string, department?: string) => {
    const q = new URLSearchParams({ from, to });
    if (department) q.set('department', department);
    return getJson<CostResult>(`/api/v1/dashboard/cost?${q}`);
  },
  classificationExport: (from: string, to: string) =>
    getJson<unknown>(`/api/v1/dashboard/classification-export?from=${from}&to=${to}`),
  classificationImport: (payload: unknown) =>
    fetch('/api/v1/admin/classification-import', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json()),
  sites: () => getJson<{ sites: Site[] }>('/api/v1/admin/sites').then((d) => d.sites),
  saveSite: (data: { name: string; subnets: string; kind?: string; active?: boolean }) =>
    fetch('/api/v1/admin/sites', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  updateSite: (id: string, data: { name?: string; subnets?: string; kind?: string; active?: boolean }) =>
    fetch(`/api/v1/admin/sites/${id}`, { method: 'PATCH', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  deleteSite: (id: string) =>
    fetch(`/api/v1/admin/sites/${id}`, { method: 'DELETE', headers: authHeader() }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  adminClaims: () => getJson<{ claims: ClaimRow[] }>('/api/v1/admin/claims').then((d) => d.claims),
  resolveClaim: (id: string, data: { type: string; category: string }) =>
    fetch(`/api/v1/admin/claims/${id}/resolve`, { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  submitClaim: (data: { userId: string; target: string; targetKind?: string; suggested: string; note?: string }) =>
    fetch('/api/v1/dashboard/claims', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
  saveCategory: (data: { appName: string; category: string; type: string; licensed?: boolean; seats?: number | null; costPerSeat?: number | null }) =>
    fetch('/api/v1/admin/categories', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  deleteCategory: (appName: string) =>
    fetch(`/api/v1/admin/categories/${encodeURIComponent(appName)}`, { method: 'DELETE', headers: authHeader() }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  adminWebRules: () => getJson<{ rules: WebRuleRow[] }>('/api/v1/admin/webrules').then((d) => d.rules),
  saveWebRule: (data: { keyword: string; category: string; type: string }) =>
    fetch('/api/v1/admin/webrules', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  deleteWebRule: (keyword: string) =>
    fetch(`/api/v1/admin/webrules/${encodeURIComponent(keyword)}`, { method: 'DELETE', headers: authHeader() }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  adminDeptRules: () => getJson<{ rules: DeptRuleRow[] }>('/api/v1/admin/dept-rules').then((d) => d.rules),
  saveDeptRule: (data: { department: string; category: string; type: string }) =>
    fetch('/api/v1/admin/dept-rules', { method: 'POST', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  deleteDeptRule: (id: string) =>
    fetch(`/api/v1/admin/dept-rules/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeader() }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  deviceHealth: () => getJson<{ rows: DeviceHealthRow[]; summary: { critical: number; warn: number; ok: number; unreported: number } }>('/api/v1/admin/devices/health'),
  events: (opts: { level?: 'error' | 'warn' | 'info'; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.level) q.set('level', opts.level);
    if (opts.limit) q.set('limit', String(opts.limit));
    const s = q.toString();
    return getJson<{ events: { ts: string; level: 'info' | 'warn' | 'error'; message: string; meta?: Record<string, unknown> }[] }>(`/api/v1/admin/events${s ? '?' + s : ''}`);
  },
  clearEvents: () => fetch('/api/v1/admin/events', { method: 'DELETE', headers: authHeader() }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  deviceHealthDetail: (id: string) => getJson<{ detail: DeviceHealthDetail }>(`/api/v1/admin/devices/health/${encodeURIComponent(id)}`).then((d) => d.detail),
  deviceRecentIntervals: (id: string) => getJson<{ intervals: { intervalStart: string; intervalSeconds: number; activeSeconds: number; idleSeconds: number; foregroundApp: string | null; windowTitle: string | null; keystrokeCount: number; mouseEvents: number; sessionLocked: boolean; user: { displayName: string | null } | null }[] }>(`/api/v1/admin/devices/${encodeURIComponent(id)}/recent-intervals`),
  getSettings: () => getJson<{ settings: AppSettings; smtpConfigured: boolean }>('/api/v1/admin/settings'),
  saveSettings: (data: { alertsEnabled?: boolean; alertRecipients?: string; offlineMinutes?: number; funMode?: boolean; healthMode?: boolean; growthMode?: boolean; interpretMonitors?: boolean; employeeReportEnabled?: boolean; showDemoDevices?: boolean; privacyStoreDomainOnly?: boolean; retentionDaysIntervals?: number; selfAuditEnabled?: boolean }) =>
    fetch('/api/v1/admin/settings', { method: 'PUT', headers: { ...authHeader(), 'content-type': 'application/json' }, body: JSON.stringify(data) }).then((r) => { if (!r.ok) throw new Error(`${r.status}`); }),
  runAlerts: () =>
    fetch('/api/v1/admin/alerts/run', { method: 'POST', headers: authHeader() }).then((r) => r.json()),
  hourly: (userId: string, from: string, to: string) =>
    getJson<{ rows: HourlyRow[] }>(
      `/api/v1/dashboard/hourly?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`,
    ).then((d) => d.rows),
  hourlyApps: (userId: string, from: string, to: string) =>
    getJson<{ hours: { hourStart: string; work: number; nonwork: number; unknown: number; idle: number; locked: number; apps: { app: string; minutes: number }[] }[] }>(
      `/api/v1/dashboard/hourly-apps?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`,
    ).then((d) => d.hours),
  summary: (from: string, to: string, department?: string) =>
    getJson<{ summary: SummaryRow[] }>(
      `/api/v1/dashboard/summary?from=${from}&to=${to}${department ? `&department=${encodeURIComponent(department)}` : ''}`,
    ).then((d) => d.summary),
  devices: () => getJson<{ devices: Device[] }>('/api/v1/admin/devices').then((d) => d.devices),
  adminUsers: () => getJson<{ users: AdminUserRow[] }>('/api/v1/admin/users').then((d) => d.users),
  audit: () => getJson<{ rows: AuditRow[] }>('/api/v1/admin/audit').then((d) => d.rows),
  patchDevice: (id: string, active: boolean) =>
    fetch(`/api/v1/admin/devices/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ active }),
    }).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
    }),
  patchUser: (id: string, data: { displayName?: string; department?: string; active?: boolean; hourlyRate?: number | null }) =>
    fetch(`/api/v1/admin/users/${id}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
    }),
  sendReport: async (): Promise<{ ok?: boolean; error?: string; rows?: number; recipients?: number }> => {
    const res = await fetch('/api/v1/admin/report/send', { method: 'POST', headers: authHeader() });
    return res.json();
  },
  exportHourly: (from: string, to: string, opts: { userId?: string; department?: string } = {}) => {
    const q = new URLSearchParams({ from, to });
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.department) q.set('department', opts.department);
    return downloadFile(`/api/v1/export/hourly.xlsx?${q.toString()}`, 'focus-hourly.xlsx');
  },
  exportIntervals: (from: string, to: string, userId?: string) => {
    const q = new URLSearchParams({ from, to });
    if (userId) q.set('userId', userId);
    return downloadFile(`/api/v1/export/intervals.xlsx?${q.toString()}`, 'focus-intervals.xlsx');
  },
};
