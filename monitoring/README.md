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

## Stav (roadmap viz NAVRH.md §13)

- [x] **Blok 1.1** — kostra + datový model + migrace
- [x] **Blok 1.2** — ingest API + hodinová agregace + retence
- [ ] Blok 1.3 — dashboard (kalendář, analýza, export do Excelu)
- [ ] Blok 1.4 — Windows agent
- [ ] Blok 1.5 — MSI instalátor + GPO
