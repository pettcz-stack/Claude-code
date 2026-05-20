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

export type AuditRow = {
  id: string;
  adminIdentity: string;
  viewedUserId: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

export type Me = { username: string; role: string };

const STORAGE_KEY = 'workview_auth';

export function getCreds(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}
function setCreds(b64: string | null) {
  if (b64) sessionStorage.setItem(STORAGE_KEY, b64);
  else sessionStorage.removeItem(STORAGE_KEY);
}

function authHeader(): Record<string, string> {
  const c = getCreds();
  return c ? { authorization: `Basic ${c}` } : {};
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeader() });
  if (res.status === 401) {
    setCreds(null);
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
    const b64 = btoa(`${username}:${password}`);
    const res = await fetch('/api/v1/me', { headers: { authorization: `Basic ${b64}` } });
    if (!res.ok) throw new Error('Neplatné přihlašovací údaje');
    setCreds(b64);
    return res.json();
  },
  logout() {
    setCreds(null);
  },
  me: () => getJson<Me>('/api/v1/me'),
  isLoggedIn: () => getCreds() !== null,
};

export const api = {
  users: () => getJson<{ users: User[] }>('/api/v1/dashboard/users').then((d) => d.users),
  hourly: (userId: string, from: string, to: string) =>
    getJson<{ rows: HourlyRow[] }>(
      `/api/v1/dashboard/hourly?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`,
    ).then((d) => d.rows),
  summary: (from: string, to: string, department?: string) =>
    getJson<{ summary: SummaryRow[] }>(
      `/api/v1/dashboard/summary?from=${from}&to=${to}${department ? `&department=${encodeURIComponent(department)}` : ''}`,
    ).then((d) => d.summary),
  devices: () => getJson<{ devices: Device[] }>('/api/v1/admin/devices').then((d) => d.devices),
  audit: () => getJson<{ rows: AuditRow[] }>('/api/v1/admin/audit').then((d) => d.rows),
  exportHourly: (from: string, to: string, opts: { userId?: string; department?: string } = {}) => {
    const q = new URLSearchParams({ from, to });
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.department) q.set('department', opts.department);
    return downloadFile(`/api/v1/export/hourly.xlsx?${q.toString()}`, 'workview-hourly.xlsx');
  },
  exportIntervals: (from: string, to: string, userId?: string) => {
    const q = new URLSearchParams({ from, to });
    if (userId) q.set('userId', userId);
    return downloadFile(`/api/v1/export/intervals.xlsx?${q.toString()}`, 'workview-intervals.xlsx');
  },
};
