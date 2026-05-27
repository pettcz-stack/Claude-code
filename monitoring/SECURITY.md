# Bezpečnost a soulad

Tento dokument shrnuje **bezpečnostní model**, opatření a doporučení pro
nasazení FOCUSu (v0.2.1+). Detailnější dokument: [`docs/BEZPECNOST.md`](docs/BEZPECNOST.md).
Provozní postup nasazení: [`DEPLOY.md`](DEPLOY.md). Právní šablony: [`docs/pravni/`](docs/pravni/) — souhrnný manuál [`docs/pravni/08-pravni-manual.md`](docs/pravni/08-pravni-manual.md).

## Hlavní zásady

1. **Sbíráme jen agregované metriky**, ne obsah. Žádné screenshoty, klávesy,
   kamera, mikrofon, GPS.
2. **Defaultně privacy-first** — titulek okna se sbírá **jen** při explicitním
   `CAPTURETITLE=1` v MSI; v Nastavení lze zapnout domain-only redukci.
3. **Audit přístupů** je vždy aktivní — všechny pohledy administrátorů na data
   zaměstnanců se logují (tabulka `AccessAudit` s immutable `adminId`).
4. **Role** — `ADMIN` a `VIEWER`. Zaměstnanec **nemá přístup do dashboardu**;
   přes self-service token vidí jen svůj report a kdo se na něj díval.

## Autentizace & autorizace

### Admin dashboard

- **HttpOnly + SameSite=Strict + Secure cookie** (`focus_session`).
  JS na stránce na token nedosáhne, prohlížeč ji posílá jen v same-origin
  requestech (CSRF mitigation bez double-submit tokenu).
- **Session persistence v DB** (`AdminSession.tokenHash` = sha256(token)).
  Přežije restart serveru, centrálně revokovatelná.
- **Změna hesla z UI** (`POST /api/v1/admin/change-password`), invaliduje
  všechny ostatní sessions toho účtu.
- **Aktivní sessions panel** v Nastavení – admin vidí všechna svá přihlášení
  a může je individuálně odhlásit.
- **Rate limit /login**: 20 pokusů / 15 min / IP (brute-force ochrana).

### Agent ↔ backend

- **Per-device enrollment tokeny** (od v0.3 default). Agent při prvním běhu
  volá `POST /api/v1/ingest/enroll` se sdíleným `INGEST_TOKEN`, server vrátí
  per-device token. Únik z jednoho PC nezpřístupní data ostatních agentů.
- Token se ukládá jen jako sha256 hash v `Device.enrollmentTokenHash`.
- Sdílený `INGEST_TOKEN` zůstává jako legacy fallback pro starší agenty
  do v0.4 (pak bude zákazaný pro /ingest, jen pro /enroll).
- **TLS validace v C# agentovi**: žádný override `ServerCertificateValidationCallback`,
  HTTPS povinné (kromě localhostu nebo explicitního `AllowInsecureHttp=1`).

### Self-service zaměstnanec

- Token vázaný na Windows SID, podepsaný HMAC-SHA256 sdíleným secret, 12h TTL.
- Klient ho čte z **URL fragmentu** (`#selfToken=…`, neposílá se na server)
  a okamžitě přesune do `sessionStorage` + uklidí z historie.
- Při API voláních posílán v `Authorization: Bearer` headeru, NIKDY v query.
- Rate limit `/api/v1/self/*`: 60 req/min/IP.

## Šifrování a transport

- **Agent → backend**: pouze HTTPS / TLS 1.2 nebo 1.3. Default validace
  certifikátů (žádný cert pinning).
- **Dashboard ↔ backend**: HTTPS, HttpOnly cookie.
- **Heslo administrátora**: scrypt hash (saltovaný, vestavěný v Node).
- **At-rest**: doporučeno na úrovni diskového svazku (LUKS / BitLocker /
  Azure Disk Encryption / Postgres TDE) — viz `DEPLOY.md`.

## HTTP bezpečnostní hlavičky

- `Content-Security-Policy`: `default-src 'self'`, `script-src 'self'`
  (bez unsafe-inline), `base-uri 'none'`, `form-action 'self'`.
- `Strict-Transport-Security`: max-age 1 rok (jen v production).
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `upgrade-insecure-requests` v production.

## Databáze

- **PostgreSQL** doporučeno v produkci. Připojení přes `DATABASE_URL`.
- Schéma vytvoří `prisma migrate deploy`.
- **Cuid validace** URL parametrů `:id` / `:deviceId` před vstupem do Prisma.
- Doporučujeme **šifrování na disku** a **denní zálohy** (skripty
  `scripts/focus-backup.sh` + `scripts/focus-restore-test.sh`).

## Co backend odmítne v produkci

V `NODE_ENV=production` backend **odmítne start**, pokud najde slabá výchozí
tajemství (`ADMIN_PASSWORD=admin/heslo/password`, `INGEST_TOKEN` pod 24 znaků
nebo placeholder, `ENABLE_DEMO_DATA=true`) — viz
`backend/src/config.ts::assertProductionSecrets()`.

## Self-audit v UI

V Nastavení → **Bezpečnostní self-audit** admin uvidí 8 checků se stavem
pass/warn/fail a remediation hintem. Včetně síly tokenu, % per-device
enrollment, stavu retenční politiky, audit logu atd.

## Agent — co je na klientském PC

| Soubor / klíč | Kde | Co obsahuje |
|---|---|---|
| `MA win 32.exe` | `C:\Program Files\WorkView\` | proces agenta |
| `MA win 32 Service.exe` (`MAWin32` služba) | Services | watchdog, restartuje agenta po pádu |
| `HKLM\SOFTWARE\WorkView\BackendUrl` | registry | URL serveru |
| `HKLM\SOFTWARE\WorkView\IngestToken` | registry | sdílený enrollment token |
| `HKLM\SOFTWARE\WorkView\DeviceToken` | registry | per-device token (po enrollmentu) |
| `HKLM\SOFTWARE\WorkView\CaptureWindowTitle` | registry | 0/1 – sběr titulku okna |
| `%ProgramData%\WorkView\spool.ndjson` | disk | buffer při výpadku sítě |
| `%ProgramData%\WorkView\agent.log` | disk | log agenta (rotace po 1 MiB) |

Agent se **viditelně** přihlásí v Task Manageru — záměrně (transparentnost
dle §316 ZP).

## GDPR

| Princip | Jak je řešeno |
|---|---|
| **Minimalizace dat** | Sbírají se jen agregované metriky; titulky oken opt-in; retence v UI |
| **Účel** | Pouze sledování využití firemního zařízení pro produktivitu a HW údržbu |
| **Souhrnný právní manuál** | [`docs/pravni/08-pravni-manual.md`](docs/pravni/08-pravni-manual.md) — kompletní rámec ČR + EU (GDPR, ZP, NOZ, TZ) |
| **Transparentnost** | Šablona poučení v [`docs/pravni/01-informace-zamestnancum.md`](docs/pravni/01-informace-zamestnancum.md) |
| **Právo na přístup (čl. 15)** | `GET /api/v1/self/report` + `/self/audit` |
| **Právo na výmaz (čl. 17)** | `DELETE /api/v1/admin/users/:id?confirm=DELETE` — kaskádový hard-delete aktivit + pseudonymizace profilu |
| **Právo na přenositelnost (čl. 20)** | `GET /api/v1/admin/users/:id/export` (admin) + `GET /api/v1/self/export` (self-service) |
| **Retenční politika** | `RAW_RETENTION_DAYS=35`, `HOURLY_RETENTION_DAYS=540`, `AUDIT_RETENTION_DAYS=365`; automatický cron 03:30 |
| **Bezpečnost zpracování** | HTTPS, scrypt, per-device tokens, HttpOnly cookie, audit log s immutable adminId |
| **DPIA** | Šablona v [`docs/pravni/02-dpia-podklad.md`](docs/pravni/02-dpia-podklad.md) |
| **DPA (SaaS)** | [`docs/pravni/04-dpa-vzor.md`](docs/pravni/04-dpa-vzor.md) |
| **Privacy Policy** | [`docs/pravni/05-privacy-policy.md`](docs/pravni/05-privacy-policy.md) |
| **RRPP záznam čl. 30** | [`docs/pravni/06-rrpp-vzor.md`](docs/pravni/06-rrpp-vzor.md) |
| **Incident Response Plan** | [`docs/pravni/07-incident-response.md`](docs/pravni/07-incident-response.md) |

## Observability & monitoring

- `GET /api/v1/health` — DB ping, vrací `{status: ok}`.
- `GET /api/v1/metrics` — Prometheus text format. Čítače HTTP, ingest,
  login, audit. Gauges aktivních zařízení a uživatelů. Histogram response time.
- Structured logger (JSON v production) — připraveno pro Loki / CloudWatch.

## Supply-chain

- `NOTICES.md` — kompletní inventář OSS dependencí a jejich licencí.
- CI license guard (`monitoring-ci.yml`) — selže, pokud někdo přidá závislost
  pod GPL/LGPL/AGPL nebo jinou licencí mimo whitelist.
- Dependabot (`.github/dependabot.yml`) — weekly npm + monthly NuGet + monthly
  GitHub Actions security PR.

## Hlášení zranitelností

Bezpečnostní problém prosím **NEhlas veřejně**. Napiš e-mailem na
**[DOPLŇTE-bezpecnost@…]** s detaily a krokem k reprodukci. Reagujeme do 72 hodin.
Pro koordinované zveřejnění viz [`docs/pravni/07-incident-response.md`](docs/pravni/07-incident-response.md).

## Pravidelná údržba

- **Týdně:** projít Dependabot PR (security advisories).
- **Měsíčně:** `npm audit` v backend + frontend, ověření že `scripts/focus-backup.sh`
  běží + 1× test obnovy ze zálohy přes `scripts/focus-restore-test.sh`.
- **Čtvrtletně:** rotace `INGEST_TOKEN` (per-device tokeny se autoadminem
  obrotují při příštím enrollmentu).
- **Ročně:** externí penetrační test (doporučeno ~60–120 tis. Kč v ČR).
