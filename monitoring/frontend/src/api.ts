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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

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
  exportHourlyUrl: (from: string, to: string, opts: { userId?: string; department?: string } = {}) => {
    const q = new URLSearchParams({ from, to });
    if (opts.userId) q.set('userId', opts.userId);
    if (opts.department) q.set('department', opts.department);
    return `/api/v1/export/hourly.xlsx?${q.toString()}`;
  },
  exportIntervalsUrl: (from: string, to: string, userId?: string) => {
    const q = new URLSearchParams({ from, to });
    if (userId) q.set('userId', userId);
    return `/api/v1/export/intervals.xlsx?${q.toString()}`;
  },
};
