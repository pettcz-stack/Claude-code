# WorkView – monitoring pracovní aktivity

Interní nástroj pro sledování využití firemních **Windows** zařízení v souladu
s § 316 zákoníku práce. Sbírá **pouze agregované metriky** (aktivní/nečinný čas,
aktivní aplikace, počet úhozů a pohybů myši) — **žádné screenshoty, žádný
keylogging obsahu, žádný mikrofon/kamera**. Plný návrh: [`../docs/monitoring/NAVRH.md`](../docs/monitoring/NAVRH.md).

## Struktura

```
monitoring/
  backend/      Node.js + TypeScript + Prisma (ingest, agregace, API)
  frontend/     React + TypeScript (dashboard) – Blok 1.3
  agent/        C#/.NET Windows agent – Blok 1.4
  installer/    WiX .msi + GPO dokumentace – Blok 1.5
```

## Backend – rychlý start (dev, SQLite)

```bash
cd monitoring/backend
cp .env.example .env
npm install
npm run prisma:migrate -- --name init   # vytvoří dev.db + migrace
npm run seed                            # demo data pro dashboard
npm run dev                             # http://localhost:4000/api/v1/health
```

Produkce běží na PostgreSQL — viz `prisma/schema.postgres.prisma`.

### Simulátor agenta (bez Windows)

Pošle realistická data jako skutečný agent – pro vyzkoušení celého řetězce:

```bash
WORKVIEW_BACKEND_URL=http://localhost:4000 INGEST_TOKEN=dev-token \
  npm run simulate -- --machine SIM-PC-1 --sid S-1-5-21-SIM-1 --minutes 120
```

## Stav (roadmap viz NAVRH.md §13)

- [x] **Blok 1.1** — kostra + datový model + migrace
- [x] **Blok 1.2** — ingest API + hodinová agregace + retence
- [x] **Blok 1.3** — dashboard (kalendář, firemní přehled, export do Excelu)
- [x] **Blok 1.4** — Windows agent (C#/.NET 4.8) — build/běh na Windows
- [x] **Blok 1.5** — MSI instalátor (WiX) + GPO nasazení + .bat fallback
- [x] **Blok 1.6** — právní šablony (informace, DPIA, balanční test) → `../docs/monitoring/pravni/`
- [x] **Blok 1.7** — role/přístup (ADMIN/VIEWER), audit log, centrální správa agentů
- [x] **Blok 1.8** — e-mailové reporty (nodemailer, cron, ruční spuštění)

**Fáze 1 (MVP) hotová.**

Vylepšení MVP:
- [x] lokální čas v dashboardu (časové pásmo prohlížeče, řeší letní čas)
- [x] kategorizace aplikací (Práce/Komunikace/Web) – „v čem pracoval"
- [x] automatické testy backendu (vitest – unit + integrace) → `npm test`

Rozšíření:
- [x] e-mailová upozornění (pirátské praktiky + výpadek agenta) + Nastavení v UI
- [x] bezpečnostní hardening (tokeny, rate limit, CSP) – viz `../docs/monitoring/BEZPECNOST.md`
- [x] Přehled firmy (KPI, srovnání oddělení, heatmapa „kdy se pracuje")
- [x] Home Office vyhodnocení (efektivita HO vs. kancelář)
- [x] počet monitorů + efektivita dle monitorů, fragmentace pozornosti
- [x] Report zaměstnance: anonymizované srovnání + zábavný a zdravotní režim

Nápady do budoucna:
- self-service přístup pro zaměstnance (vlastní login) + soutěž „Zaměstnanec měsíce"
- AD/SSO přihlášení + manažerské role (jen své oddělení)
- 2FA pro admina, per-device tokeny, Teams notifikace, PDF reporty
- flat ESLint config (eslint v9+), code-splitting dalších stránek

Další fáze (čeká na přístupy):
- [ ] Blok 2.1 — adaptér OKbase (absence/HO/dovolená)
- [ ] Blok 3.1 — adaptér Outlook/Exchange (meetingy)

## Testy

```bash
cd monitoring/backend && npm test   # vitest (vlastní SQLite test.db)
```

## Nasazení on-premise (Docker)

PostgreSQL + backend + frontend přes docker-compose:

```bash
cd monitoring
# nastav tajemství (jinak se použijí defaulty)
export ADMIN_PASSWORD=... INGEST_TOKEN=... DB_PASSWORD=...
docker compose up -d --build
# dashboard: http://localhost:8080
```

Backend při startu synchronizuje schéma do PostgreSQL (`prisma db push` proti
`schema.postgres.prisma`). Agent posílá data na `http(s)://<server>/api` (přes
nginx proxy frontendu, nebo přímo na backend:4000).

