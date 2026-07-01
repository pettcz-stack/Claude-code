function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function list(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

  // --- ČÚZK / WSDP (realizované ceny z katastru) ---
  cuzk: {
    // Endpoint služby Sestavy WSDP. Výchozí = zkušební (trial) prostředí.
    // Produkce: https://katastr.cuzk.cz/dokumentace/... (dle dokumentace ČÚZK)
    wsdpEndpoint:
      process.env.CUZK_WSDP_ENDPOINT ??
      "https://wsdptrial.cuzk.cz/trial/ws/sestavy/V_2.9/sestavy",
    username: process.env.CUZK_WSDP_USER ?? "",
    password: process.env.CUZK_WSDP_PASSWORD ?? "",
    // Seznam kódů katastrálních území ke stažení (čárkami). Prázdné = nic.
    targetKuCodes: list("CUZK_TARGET_KU"),
    // Prodleva mezi dotazy na KÚ (ms) — šetrnost + rate limiting.
    delayMs: num("CUZK_DELAY_MS", 1500),
    // Kolik sekund maximálně čekat na vygenerování jedné sestavy.
    pollTimeoutSec: num("CUZK_POLL_TIMEOUT_SEC", 120),
  },
};
