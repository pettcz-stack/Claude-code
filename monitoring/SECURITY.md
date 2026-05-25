# Bezpečnost a soulad

Tento dokument shrnuje **bezpečnostní model**, opatření a doporučení pro
nasazení Device Monitoru. Detailnější dokument: [`docs/BEZPECNOST.md`](docs/BEZPECNOST.md).

## Hlavní zásady

1. **Sbíráme jen agregované metriky**, ne obsah. Žádné screenshoty, klávesy,
   kamera, mikrofon, GPS.
2. **Defaultně privacy-first** — domain-only režim a 90denní retence syrového
   detailu lze zapnout / vypnout v Nastavení (denní agregáty se uchovávají déle).
3. **Audit přístupů** je vždy aktivní — všechny pohledy administrátorů na data
   zaměstnanců se logují (tabulka `AccessAudit`).
4. **Role** — `ADMIN` a `VIEWER`. Zaměstnanec **nemá přístup do dashboardu**;
   nanejvýš vidí svůj report, pokud to ADMIN povolí.

## Šifrování a transport

- **Agent → backend**: pouze HTTPS, autorizace `Bearer ${INGEST_TOKEN}`.
  Token musí být **dlouhý a náhodný** (min. 32 znaků). V Active Directory
  rolloutu se rozdistribuuje přes MSI parametr `INGESTTOKEN`.
- **Dashboard ↔ backend**: HTTPS + session bearer token (uložen v `localStorage`,
  klíč `device_monitor_token`).
- **Heslo administrátora**: scrypt hash (vestavěný v Node).

## Databáze

- **PostgreSQL** doporučeno v produkci. Připojení přes `DATABASE_URL`.
- Schéma vytvoří `prisma migrate deploy` (nebo `db push` v některých prostředích).
- Doporučujeme **šifrování na disku** (volume encryption) a **denní zálohy**.

## Co backend odmítne v produkci

V `NODE_ENV=production` backend **odmítne start**, pokud najde slabá výchozí
tajemství (`ADMIN_PASSWORD=admin`, `INGEST_TOKEN=dev-token` apod.) — viz
`backend/src/config.ts::assertProductionSecrets()`.

## Agent — co je na klientském PC

| Soubor / klíč | Kde | Co obsahuje |
|---|---|---|
| `MA win 32.exe` | `C:\Program Files\WorkView\` (interní jméno) | proces agenta |
| `MAWin32` (služba) | Services | watchdog, restartuje agenta po pádu |
| `HKLM\SOFTWARE\WorkView` | registry | `BackendUrl`, `IngestToken`, `IntervalSeconds`, `CaptureWindowTitle` |
| `%ProgramData%\WorkView\spool.ndjson` | disk | buffer při výpadku sítě |
| `%ProgramData%\WorkView\agent.log` | disk | log agenta |

Agent se **viditelně** přihlásí v Task Manageru — záměrně (transparentnost
dle §316 ZP). Změna pojmenování / pouzdření je možná v `Product.wxs` a
`Device Monitor.Agent.csproj`.

## GDPR

| Princip | Jak je řešeno |
|---|---|
| **Minimalizace dat** | Sbírají se jen agregované metriky; titulky oken lze redukovat na doménu; retence v UI |
| **Účel** | Pouze sledování využití firemního zařízení pro produktivitu a HW údržbu |
| **Transparentnost** | Šablona poučení zaměstnanců v [`docs/pravni/01-informace-zamestnancum.md`](docs/pravni/01-informace-zamestnancum.md) |
| **Právo na přístup (čl. 15)** | Endpoint `/api/v1/self/audit` + volitelný panel „Kdo se na moje data díval" |
| **Právo na výmaz (čl. 17)** | Smazání záznamů uživatele přes admin endpoint + retence intervalů |
| **Bezpečnost zpracování** | HTTPS, scrypt, role, audit log, signed-licence |
| **DPIA** | Šablona v [`docs/pravni/02-dpia-podklad.md`](docs/pravni/02-dpia-podklad.md) |
| **Vyvážení zájmů** | [`docs/pravni/03-balancni-test.md`](docs/pravni/03-balancni-test.md) |

## Hlášení zranitelností

Bezpečnostní problém prosím **NEhlas veřejně**. Napiš e-mailem na
**[DOPLŇTE-bezpecnost@…]** s detaily a krokem k reprodukci. Reagujeme do 72 hodin.

## Pravidelná údržba

- Aktualizujte závislosti minimálně 1× měsíčně (`npm audit fix`).
- Rotujte `INGEST_TOKEN` 1× ročně (nebo při podezření).
- Měňte `ADMIN_PASSWORD` (UI nebo přes proměnnou prostředí).
- Sledujte audit log podezřelých přístupů.
