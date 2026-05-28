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

export const PHASE_LABEL: Record<string, string> = {
  new: "Nový",
  awaiting_ack: "Čeká na potvrzení",
  awaiting_eta: "Čeká na termín",
  in_progress: "Probíhá",
  awaiting_result: "Čeká na výsledek",
  blocked: "Zablokovaný",
  acked: "Potvrzen",
  done: "Hotovo",
  dropped: "Zrušen",
};

export const LEVEL_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Upozornění",
  urgent: "Urgentní",
};
