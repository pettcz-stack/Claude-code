// Centrální mapy pro vizualizaci

export const PHASE_LABEL: Record<string, string> = {
  new: "Nový",
  awaiting_ack: "Čeká na potvrzení",
  awaiting_eta: "Čeká na termín",
  in_progress: "Probíhá",
  awaiting_result: "Čeká na výsledek",
  blocked: "Zablokovaný",
  acked: "Potvrzen mnou",
  done: "Hotovo",
  dropped: "Zrušen",
};

// Tailwind palette: bg / text / border tříd pro každou fázi
export const PHASE_STYLE: Record<string, string> = {
  new:               "bg-blue-500/15 text-blue-300 border-blue-500/30",
  awaiting_ack:      "bg-amber-500/15 text-amber-300 border-amber-500/30",
  awaiting_eta:      "bg-orange-500/15 text-orange-300 border-orange-500/30",
  in_progress:       "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  awaiting_result:   "bg-purple-500/15 text-purple-300 border-purple-500/30",
  blocked:           "bg-rose-500/15 text-rose-300 border-rose-500/30",
  acked:             "bg-sky-500/15 text-sky-300 border-sky-500/30",
  done:              "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  dropped:           "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export const LEVEL_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Upozornění",
  urgent: "Urgentní",
};

export const LEVEL_STYLE: Record<string, string> = {
  info:    "bg-sky-500/15 text-sky-300 border-l-sky-500",
  warning: "bg-amber-500/15 text-amber-300 border-l-amber-500",
  urgent:  "bg-rose-500/15 text-rose-300 border-l-rose-500",
};

export function initials(name: string, email: string): string {
  const src = (name || email || "?").trim();
  if (!src) return "?";
  const parts = src.split(/[\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// Deterministická barva avataru z emailu
export function avatarColor(seed: string): string {
  const colors = [
    "bg-blue-500/30 text-blue-200",
    "bg-emerald-500/30 text-emerald-200",
    "bg-purple-500/30 text-purple-200",
    "bg-amber-500/30 text-amber-200",
    "bg-rose-500/30 text-rose-200",
    "bg-cyan-500/30 text-cyan-200",
    "bg-orange-500/30 text-orange-200",
    "bg-indigo-500/30 text-indigo-200",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "před chvílí";
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`;
  return `před ${Math.floor(diff / 86400)} dny`;
}

export const PRIORITY_LABEL: Record<number, string> = {
  1: "P1 · vysoká",
  2: "P2 · normální",
  3: "P3 · nízká",
};
export const PRIORITY_DOT: Record<number, string> = {
  1: "bg-rose-500",
  2: "bg-amber-400",
  3: "bg-zinc-400",
};
export const PRIORITY_TEXT: Record<number, string> = {
  1: "text-rose-300",
  2: "text-amber-300",
  3: "text-zinc-300",
};

export function deadlineLabel(iso: string | null): { text: string; style: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  const diffH = diffMs / 3_600_000;
  if (diffH < 0) {
    const past = Math.abs(diffH);
    const label = past < 24 ? `${Math.floor(past)} h po termínu` : `${Math.floor(past / 24)} dny po termínu`;
    return { text: label, style: "text-rose-400" };
  }
  if (diffH < 24) {
    return { text: `za ${Math.floor(diffH)} h`, style: "text-amber-300" };
  }
  if (diffH < 24 * 7) {
    return { text: `za ${Math.floor(diffH / 24)} dní`, style: "text-cyan-300" };
  }
  return { text: d.toLocaleDateString("cs-CZ"), style: "text-muted" };
}
