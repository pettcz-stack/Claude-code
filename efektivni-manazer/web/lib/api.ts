export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8091";

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type Task = {
  id: number;
  thread_id: number;
  direction: "delegated" | "mine";
  phase: string;
  counterpart_email: string;
  counterpart_name: string;
  title: string;
  summary: string;
  requested_output: string;
  deadline: string | null;
  last_activity_at: string;
  snoozed_until: string | null;
  closed_at: string | null;
  manual_overrides?: {
    notes?: string;
    priority?: number;
    tags?: string[];
    [k: string]: any;
  };
};

export type Notification = {
  id: number;
  task_id: number;
  rule_id: number | null;
  level: "info" | "warning" | "urgent";
  message: string;
  created_at: string;
  snoozed_until: string | null;
  dismissed_at: string | null;
};

export type Rule = {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  condition: Record<string, any>;
  action: Record<string, any>;
};

export type ImapSettings = {
  host: string;
  port: number;
  use_ssl: boolean;
  username: string;
  sent_folder: string;
  inbox_folder: string;
  configured: boolean;
};

export type Profile = {
  my_email: string;
  my_aliases: string[];
  my_name: string;
};

export type CounterpartStats = {
  email: string;
  name: string;
  owes_me: number;
  i_owe: number;
  done: number;
  overdue: number;
  last_activity: string | null;
};

export type Overview = {
  open: number;
  overdue: number;
  awaiting_ack: number;
  awaiting_eta: number;
  mine_open: number;
  delegated_open: number;
};

export type TaskCreate = {
  direction: "delegated" | "mine";
  title: string;
  summary?: string;
  requested_output?: string;
  counterpart_email?: string;
  counterpart_name?: string;
  deadline?: string | null;
  phase?: string;
};

// re-export pro zpětnou kompatibilitu (před refactorem):
export { PHASE_LABEL, LEVEL_LABEL } from "./ui";
