function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 3000),
  collect: {
    maxPages: num("COLLECT_MAX_PAGES", 5),
    delayMs: num("COLLECT_DELAY_MS", 1200),
    userAgent:
      process.env.COLLECT_USER_AGENT ??
      "realitni-cenova-mapa/0.1 (osobni vyzkum)",
  },
  soldAfterDays: num("SOLD_AFTER_DAYS", 7),
};
