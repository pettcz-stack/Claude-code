# Changelog

Všechny pozoruhodné změny v projektu jsou zde. Formát inspirovaný
[Keep a Changelog](https://keepachangelog.com/). Verze: 0.1.0 (development).

## [Unreleased]

### Added (2026-04-20)

**MVP** (commit `7256013`)
- Backend: Express + TypeScript + Prisma/SQLite
- Meta OAuth flow s AES-256-GCM šifrováním Page Access Tokenů
- Graph API klient: FB posts/comments, IG media/comments, hide/delete/reply
- Polling fetcher + webhook receiver s HMAC-SHA256 ověřením
- Claude klasifikátor (haiku-4-5 → sonnet-4-6 eskalace) s prompt cachingem
- Auto-moderátor s bezpečnými defaulty (spam ≥ 0.90 → delete,
  vulgarity ≥ 0.85 → hide); `brand_attack` a `legitimate_criticism` nikdy
  automaticky
- REST API: accounts, comments (queue + bulk), rules, audit, stats, webhooks
- Audit log a CSV export (BOM pro Excel)
- Basic-auth protected dashboard API
- Cron scheduler pro periodic fetch + classify
- Frontend: React + Vite + Tailwind + TS — 5 stránek (Queue, Audit,
  Rules, Accounts, Stats)

**Operační rozšíření** (commit `897380f`)
- Slack + email notifikace při detekci `brand_attack`
- Daily cron: token-expiry monitor (14/7/3/1 den + expired)
- Daily cron: GDPR retention (anonymizuje komentáře > 730 dní)
- FB ad / dark post comments přes `promotable_posts` endpoint
- Admin API: status, manual poll, token check, retention, test notify
- Frontend: Reply modal + nová Admin stránka
- Docker: multi-stage Dockerfile + docker-compose
- ESLint + Prettier konfigurace pro backend i frontend
- Testy: classifier s mock Anthropic (22 spam samples), auto-moderator,
  Graph klient, rate-limit

**AI a operace** (commit `13123a7`)
- AI návrh odpovědi (sonnet-4-6) — POST `/api/comments/:id/suggest-reply`
- Reclassify endpoint + UI tlačítko (force smart model)
- Blacklist autorů — auto-hide s výjimkou `legitimate_criticism`
- Webhook subscribe CLI: `npm run webhooks:subscribe`
- Nové testy pro retention, token-monitor, blacklist

**Evidence a observability** (commit `1f49e7a`)
- Evidence model + `captureEvidence()` — SHA-256 content hash pro právní
  použití, automaticky při `brand_attack` / `vulgarity`
- `/api/audit/evidence` list + `/:id` JSON download
- `/metrics` Prometheus endpoint (classifications_total, actions_total,
  queue_pending, active accounts, evidence_total, last_action_age)
- Klávesové zkratky v Queue: j/k/g/G navigace, Space select,
  h/x/p/r/o akce, ? help overlay
- PostgreSQL profil (`schema.postgres.prisma` + `docker-compose.postgres.yml`)
- supertest integration test pro webhooks/meta (HMAC verify + challenge)

**Šablony a vyhledávání** (commit `24cc8a1`)
- `ReplyTemplate` model + CRUD + `{author}` placeholder
- Queue reply modal má dropdown šablon podle AI kategorie
- Nová Templates page pro správu odpovědí
- Seed: 4 české šablony (kritika, dotaz, pochvala, brand_attack)
- Full-text search v `/api/comments` (q= nad text/author)
- `/api/comments/export.csv` — plný CSV export
- CLI: `npm run classify -- "text"` pro ladění promptu

**UX polish** (commit `17af9e6`)
- Live pending-count badge v navigaci (20s polling)
- Per-comment detail drawer s plnou historií klasifikací a akcí
- React ErrorBoundary s friendly fallback
- FB permalink fallback v fetcheru pro dark posts
- GET `/api/comments/:id` vrací plnou historii

**Readiness a reklasifikace** (commit `304de91`)
- Deep `/health/ready` probe: DB ping, Anthropic key, Meta app, token
  encryption, active accounts
- POST `/api/admin/reclassify/bulk` pro hromadnou reklasifikaci po úpravě
  promptu
- README: sekce "Known limits / TODO"

### Fixed

**Ověřený end-to-end boot** (commit `14f05d3`)
- `db.ts` teď importuje `./config` jako první — dotenv naplní DATABASE_URL
  před Prisma init
- `cache_control` cast pro Anthropic SDK 0.30 (typy nemají tu property)
- `express-basic-auth` Request augmentace explicitním castem
- `routes/webhooks.test.ts`: přesun `fetchAccountMock` do `vi.hoisted()`
- Committed initial Prisma migration a `package-lock.json`

**Stats route** (commit `f7c5ff6`)
- Raw SQLite `substr(datetime(fetchedAt), ...)` + `julianday()` vracely null
  pro Prisma's integer-epoch storage — UI crashoval na `day.slice(5)`
- Přepsáno na JS-side agregaci přes typed Date objekty; pracuje stejně
  na SQLite i Postgres

### Added (2026-04-20, pozdní večer)

**Demo mode + preflight** (commit `0df6f82`)
- `scripts/demo.sh` + `npm run demo`: idempotentní bootstrap
  (install → migrate → seed → build → start) s autogenerovaným
  encryption key
- `scripts/doctor.ts` + `npm run doctor`: 11-bodová preflight kontrola
- Offline klasifikátor: keyword heuristika místo pádu, když chybí
  `ANTHROPIC_API_KEY`; 10 unit testů pokrývá heuristiku
- `QUICKSTART.md` — macOS copy-paste setup
- `docs/SCREENSHOTS.md` — galerie UI

**Galerie screenshotů** (commit `23381f9`)
- `docs/screenshots/00-gallery.png` — 3×3 mřížka všech 9 obrazovek
- `scripts/contact-sheet.mjs` — puppeteer skript pro generování

**CI + testy + security audit** (dnes plánovaný commit)
- `.github/workflows/ci.yml` — build + test + smoke-boot na každý push
- Nové testy: templates route (8), stats route (4) — celkem **69/69 tests passing**
- `SECURITY.md` — self-audit proti OWASP Top 10; oprava CORS reflected-origin
  s credentials (Fix: explicitní allowlist)
- `CHANGELOG.md` — tento dokument

## Statistiky (stav 2026-04-20 22:00)

- **13** commitů na `claude/meta-comment-moderator-IXbw7`
- **69/69** unit + integration testů zelených
- **7** obrazovek dashboardu
- **15** API routes + endpoints pro OAuth a webhooks
- **~8000** řádků kódu (backend + frontend)
- **~3000** řádků dokumentace (README, QUICKSTART, SECURITY,
  SCREENSHOTS, CHANGELOG)
- **9** screenshotů živého UI nad demo daty
