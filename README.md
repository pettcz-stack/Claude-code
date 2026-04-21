# ALBIXON — Moderátor komentářů (Facebook & Instagram)

Interní nástroj pro automatickou detekci a moderaci negativních, urážlivých,
spamových a konkurenčně poškozujících komentářů na firemních profilech ALBIXON
a BRILIX. Klasifikace probíhá přes **Claude API**, akce (skrýt/smazat/odpovědět)
se vykonávají přes oficiální **Meta Graph API**. Operátor má poslední slovo —
auto-moderace je zapnutá jen pro jednoznačný spam a vulgarismy.

---

## 📚 Dokumentace — kde co najdeš

**Pro vývojáře / zkušení technici:**

| Dokument | Komu | Co obsahuje |
|---|---|---|
| [**README.md**](README.md) ← tady | Technici | Instalace, architektura, API reference, bezpečnost |
| [**QUICKSTART.md**](QUICKSTART.md) | Technici | 5minutový start na macOS pro demo / lokální testing |
| [**CHANGELOG.md**](CHANGELOG.md) | Všichni | Historie změn v commitech |

**Pro admina (IT odpovědný za provoz):**

| Dokument | Co obsahuje |
|---|---|
| [**deploy/DEPLOYMENT.md**](deploy/DEPLOYMENT.md) | 45minutový recept — VPS, systemd, Caddy + TLS, backup, onboarding operátorů |
| [**deploy/Caddyfile**](deploy/Caddyfile) | TLS reverse proxy konfigurace s Let's Encrypt |
| [**SECURITY.md**](SECURITY.md) | Security audit (OWASP Top 10), známé limity, produkční checklist |
| [**TROUBLESHOOTING.md**](TROUBLESHOOTING.md) | Co dělat, když něco nefunguje |

**Pro MKT tým (operátory, kteří moderují):**

| Dokument | Co obsahuje |
|---|---|
| [**PRIRUCKA.md**](PRIRUCKA.md) | **Kompletní návod česky, 15 min čtení** — role, kategorie, akce, zkratky, odpovědi, alerty |
| [**docs/SCREENSHOTS.md**](docs/SCREENSHOTS.md) | Galerie UI — jak vypadá každá obrazovka |

**Doporučený postup podle role:**

- **Vývojář / nasazuje poprvé:** `README` → `QUICKSTART` (zkus lokálně) → `deploy/DEPLOYMENT.md` (nasadíš) → `SECURITY.md` (před spuštěním týmu)
- **Admin:** `deploy/DEPLOYMENT.md` → `TROUBLESHOOTING.md` → (operátorům pošli) `PRIRUCKA.md`
- **MKT operátor:** otevři jen `PRIRUCKA.md`, stačí to

---

## Rychlý start

### 1. Klonování a instalace

```bash
git clone <repo-url>
cd albixon-meta-moderator
npm install
```

### 2. `.env`

Zkopíruj `.env.example` na `.env` a vyplň:

```bash
cp .env.example .env
```

Vygeneruj 32-bytový šifrovací klíč pro Meta tokeny:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

A vlož ho do `TOKEN_ENCRYPTION_KEY`.

Dále doplň:

- `ANTHROPIC_API_KEY` — z [console.anthropic.com](https://console.anthropic.com)
- `META_APP_ID`, `META_APP_SECRET` — z Meta aplikace (viz níže)
- `META_WEBHOOK_VERIFY_TOKEN` — libovolný silný řetězec
- `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` — přihlašovací údaje do dashboardu

### 3. Databáze

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 4. Spuštění (dev režim)

```bash
npm run dev
```

Backend poběží na `http://localhost:3000`, frontend dev server na
`http://localhost:5173` (s proxy na backend).

### 5. Připojení Meta účtů

Otevři dashboard (http://localhost:5173), přihlas se (basic auth), jdi na
**Účty** → **Připojit přes Meta** a projdi OAuth flow. Po úspěšném připojení
se automaticky uloží Page Access Token pro všechny stránky, ke kterým máš
přístup, a zároveň se připojí i odpovídající Instagram Business účet.

---

## Nastavení Meta aplikace

1. Jdi na [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** → typ **Business**.
2. Propoj aplikaci s Business Manager účtem ALBIXON.
3. Přidej produkty:
   - **Facebook Login for Business**
   - **Instagram Graph API**
   - **Webhooks**
4. V nastavení **Facebook Login for Business** přidej redirect URI:
   `http://localhost:3000/auth/callback` (pro produkci nahraď skutečnou doménou).
5. V **App Review** si vyžádej scopes:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_engagement`
   - `pages_manage_posts`
   - `pages_read_user_content`
   - `instagram_basic`
   - `instagram_manage_comments`
6. **Webhooks** nastav callback URL na `https://<tvůj-host>/webhooks/meta`
   a `verify_token` shodný s `META_WEBHOOK_VERIFY_TOKEN` v `.env`. Odeber
   subscription pro `feed` a `comments` (Page) a `comments` (Instagram).

Během vývoje můžeš místo webhooků využívat polling — backend sám sleduje
`POLL_INTERVAL_MINUTES` (výchozí 5 min).

Po propojení stránek spustíš subscription na webhooky:

```bash
npm --workspace backend run webhooks:subscribe
# nebo suchý běh bez volání API:
npm --workspace backend run webhooks:subscribe -- --dry-run
```

Script přihlásí každou aktivní FB stránku ke `feed,comments,mention` fieldům.

## Ladění promptu

Rychlá klasifikace libovolného textu z příkazové řádky (užitečné při úpravách
systémového promptu):

```bash
npm --workspace backend run classify -- "Tohle je hrozný produkt!"
npm --workspace backend run classify -- --smart --author "Jan Novák" "Nefunguje mi ovládání..."
cat samples.txt | npm --workspace backend run classify -- --stdin
```

---

## Architektura

```
Meta Graph API  ──┐
                  │  (OAuth / polling / webhooks)
                  ▼
           ┌──────────────┐
           │  backend     │  Express + TypeScript
           │  (Node.js)   │  Prisma + SQLite
           │              │
           │  ┌─────────┐ │
           │  │ fetcher │ │
           │  └────┬────┘ │
           │       ▼      │
           │  ┌─────────┐ │       Claude API
           │  │ class-  ├─┼──────► (haiku-4-5 fast,
           │  │ ifier   │ │         sonnet-4-6 smart escalate)
           │  └────┬────┘ │
           │       ▼      │
           │  ┌─────────┐ │
           │  │ auto-   │ │
           │  │ mod     │ │
           │  └────┬────┘ │
           │       ▼      │
           │  ┌─────────┐ │       Meta Graph API
           │  │ action  ├─┼──────► (hide / delete / reply)
           │  └─────────┘ │
           └──────┬───────┘
                  │  REST /api/*
                  ▼
           ┌──────────────┐
           │  frontend    │  React + Vite + Tailwind
           │  (dashboard) │
           └──────────────┘
```

---

## Cesty v API

| Metoda | Cesta | Popis |
|-------|-------|-------|
| GET   | `/health` | Liveness probe (always 200) |
| GET   | `/health/ready` | Readiness probe (DB, config, Anthropic, accounts) |
| GET   | `/auth/start` | Spuštění Meta OAuth |
| GET   | `/auth/callback` | Meta OAuth callback |
| GET/POST | `/webhooks/meta` | Webhook endpoint (GET = verify, POST = událost) |
| GET   | `/api/comments` | Fronta komentářů (filtry: status, platform, category, accountId, from, to) |
| POST  | `/api/comments/:id/action` | Provést akci (hide / delete / keep / reply / unhide) |
| POST  | `/api/comments/:id/suggest-reply` | Claude vygeneruje návrh odpovědi (sonnet-4-6) |
| POST  | `/api/comments/:id/reclassify` | Znovu klasifikovat (volitelně `{ "smart": true }`) |
| GET   | `/api/comments/export.csv` | Export všech komentářů + klasifikací |
| POST  | `/api/comments/bulk-action` | Hromadná akce |
| CRUD  | `/api/templates` | Šablony odpovědí (s placeholderem `{author}`) |
| POST  | `/api/templates/:id/render` | Vyrenderovat šablonu s proměnnými |
| GET   | `/api/comments/stats/summary` | Počet čekajících a zpracovaných |
| GET   | `/api/accounts` | Seznam připojených účtů |
| PATCH/DELETE | `/api/accounts/:id` | Aktivace / odpojení |
| POST  | `/api/accounts/:id/fetch` | Okamžité stažení nových komentářů |
| CRUD  | `/api/rules` | Pravidla auto-moderace |
| GET/POST | `/api/rules/settings/pause` | Pauza auto-moderace |
| CRUD  | `/api/rules/lists` | Whitelist/Blacklist slova/autoři |
| GET   | `/api/audit` | Obecný audit log |
| GET   | `/api/audit/actions` | Audit provedených akcí |
| GET   | `/api/audit/export.csv` | CSV export (BOM pro Excel) |
| GET   | `/api/audit/evidence` | Seznam evidence snapshotů (pro právní použití) |
| GET   | `/api/audit/evidence/:id` | Stáhnout snapshot jako JSON (integrita přes SHA-256) |
| GET   | `/metrics` | Prometheus scrape endpoint (veřejný, omez síťovou politikou) |
| GET   | `/api/stats/overview?days=N` | Statistiky za N dní |
| GET   | `/api/admin/status` | Počet aktivních účtů, pending, akce za 24 h |
| POST  | `/api/admin/poll/run` | Ruční spuštění fetch + klasifikace |
| POST  | `/api/admin/tokens/check` | Ruční kontrola expirace tokenů |
| POST  | `/api/admin/retention/run` | Ruční anonymizace starších komentářů |
| POST  | `/api/admin/test-notification` | Test Slack/email notifikace |
| POST  | `/api/admin/reclassify/bulk` | Hromadná reklasifikace (`{hours, limit}`) |

Všechny `/api/*` endpointy vyžadují HTTP Basic auth (výchozí `admin` /
`change-me`, změň v `.env`).

---

## Bezpečné chování auto-moderace

- **Výchozí auto-akce:**
  - `spam` s confidence ≥ 0.90 → `delete`
  - `vulgarity` s confidence ≥ 0.85 → `hide`
- **Nikdy automaticky:**
  - `brand_attack` — vždy k právnímu review
  - `legitimate_criticism` — nikdy nemazat, jen zviditelnit operátorovi
  - Cokoli s confidence < 0.7 — vyžaduje člověka
- Auto-moderaci lze kdykoli pozastavit na záložce **Pravidla**.
- Autory z whitelistu auto-moderace ignoruje.

---

## Bezpečnost

- Meta Page Access Tokeny jsou v DB šifrované **AES-256-GCM**; klíč v `.env`.
- Claude API klíč nikdy neopouští backend.
- Audit log je append-only — komentáře se mazou z Graph API, ale záznam
  akce zůstává.
- Komunikace mimo localhost MUSÍ běžet přes TLS (reverse proxy: nginx / Caddy).
- Webhook request je ověřen HMAC-SHA256 podpisem (`X-Hub-Signature-256`).

---

## Testy

```bash
npm test
```

Unit testy pokrývají klasifikátor (schema, prompt) a šifrování tokenů.
Integrační testy proti Meta Graph API vyžadují platný sandbox a jsou
zatím mimo scope MVP.

---

## Produkční nasazení

```bash
npm run build
npm run prisma:deploy
NODE_ENV=production npm start
```

Doporučené:

- reverse proxy s TLS (Caddy/nginx)
- **PostgreSQL** místo SQLite:
  ```bash
  cp backend/prisma/schema.postgres.prisma backend/prisma/schema.prisma
  # update .env: DATABASE_URL=postgresql://...
  npm run prisma:generate && npm run prisma:deploy
  # stats routes use sqlite-specific SQL (substr/julianday) —
  # rewrite to date_trunc before switching, or disable /api/stats
  ```
  nebo prostě `docker compose -f docker-compose.postgres.yml up -d`
- systemd service nebo Docker container
- denní backup DB (evidence snapshot musí být ZÁLOHOVÁN — právní důkaz)
- Prometheus scrape `http://localhost:3000/metrics` (napojit na Grafana)

---

## Známé limity / TODO před produkcí

- **SMTP notifikace** jsou stub — v `services/notify.ts` jen logují.
  Pro produkci nahradit `nodemailer` transportem s firemním SMTP relay.
- **Stats raw SQL** je SQLite-specifické (`substr`, `julianday`). Před
  přepnutím na PostgreSQL je třeba přepsat na `date_trunc` /
  `EXTRACT(EPOCH …)`.
- **Webhook deduplication** není implementovaná — pokud Meta pošle stejný
  event víckrát (retry), fetcher stáhne stejné komentáře a Prisma `upsert`
  je idempotentně deduplikuje, ale zbytečně spotřebujeme Graph kvóty.
- **Integration testy proti reálnému Meta sandboxu** zatím nejsou —
  máme pouze unit testy s mockovaným `fetch`.
- **Session management**: používá se HTTP Basic auth. Pro víc uživatelů
  s individuálním audit logem je třeba přejít na session+OIDC.
- **App Review u Meta**: scopes `pages_manage_engagement` a
  `instagram_manage_comments` vyžadují schválení Meta před produkčním
  nasazením. Pro dev testing stačí app v development módu + role tester.
- **Rate-limit bucket** je in-memory — restart aplikace ho vynuluje.
  Pro multi-instance deployment použít Redis token bucket.

## Roadmapa

- **Fáze 1 (MVP)** ✅ — polling fetcher, Claude klasifikace, dashboard, audit
- **Fáze 2** ✅ — webhooky real-time, rozšířené auto-moderace, bulk akce,
  dark post / ad comments, reply UI, retention job, token monitor
- **Fáze 3** ✅ — statistiky, notifikace (Slack/email) při `brand_attack`,
  admin rozhraní pro manuální polling/retenci, AI návrhy odpovědí,
  reclassify s `sonnet-4-6`, blacklist autorů, webhook subscribe helper,
  evidence snapshoty pro právní použití (SHA-256 hash), `/metrics`
  endpoint, keyboard shortcuts ve frontě, PostgreSQL profil
- **Fáze 4** (budoucí) — integrace s brand monitoring agentem, nodemailer
  SMTP (místo stub), PostgreSQL migrace, integration testy proti Meta sandboxu

---

## Licence

Interní projekt ALBIXON a.s. — není určen k veřejné distribuci.
