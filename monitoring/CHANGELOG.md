# Changelog

Všechny významné změny jsou tady. Formát: [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verzování: [Semantic Versioning](https://semver.org/lang/cs/).

## [Unreleased]

### v0.9.1 — Release-candidate (pilot-ready)

Verze sjednocena napříč na **0.9.1**. Aplikace je připravená pro:

- ✅ **interní pilot** u 1–3 vybraných zákazníků
- ✅ právní rámec: poučení §316 ZP, DPIA, balanční test, RRPP záznam, DPA,
  Privacy Policy, Incident response, souhrnný právní manuál
  (`docs/pravni/01–08`)
- ✅ 5jazyčné UI (CS / SK / EN / PL / DE) s automatickým přepínačem
- ✅ Bezpečnost: per-device tokeny, HttpOnly + SameSite=Strict cookie, CSP +
  HSTS, audit log s immutable adminId, fail-fast credentials, TLS guard
- ✅ GDPR čl. 17 + 20: DELETE + EXPORT endpointy (admin i self-service),
  retenční politika, audit log retence
- ✅ Observability: structured logger, Prometheus `/api/v1/metrics`
- ✅ CI: 31 backend + 5 frontend testů zelená, license guard, Dependabot
- ✅ Funkce: aktivita, HW telemetrie, Tisk & USB monitoring (opt-in)

**Co stále zbývá před GA (Sprint 2 po pilotu):**

- ⏳ MSI digitální podpis (vyžaduje EV cert ~5–15 tis. Kč/rok)
- ⏳ Externí penetrační test (~60–120 tis. Kč v ČR)
- ⏳ Schválení všech `docs/pravni/` šablon advokátem + DPO
  (s konkrétními údaji zákazníka)
- ⏳ Reálné nasazení a load test na 100+ PC v doménovém AD prostředí

### v0.3.0 — Tisk & USB monitoring

Nová samostatná funkce pro sledování tiskových úloh a přesunů souborů na USB.
Vše OPT-IN s default OFF, server-side enforcement schování názvů.

- **Schéma**: PrintJob + UsbFileEvent (Prisma migrace 20260527092544_print_usb)
- **Ingest endpointy**: POST /api/v1/ingest/print + /api/v1/ingest/usb
  (dávkové, max 500 / 1000 záznamů, vyžadují per-device token)
- **Admin endpointy**: GET /admin/print/summary, /print/user/:id,
  /usb/summary, /usb/user/:id. Drill-down loguje VIEW do AccessAudit.
- **Settings**: 4 nové toggles (`printTrackingEnabled`, `capturePrintDocName`,
  `usbTrackingEnabled`, `captureUsbFilename`) – sekce „Tisk & USB monitoring"
  v Nastavení → Soukromí. Capture* je vždy závislý na hlavním tracking flagu.
- **Self-audit security check**: warn pokud je capturePrintDocName nebo
  captureUsbFilename zapnuté – připomínka pro DPIA + balanční test.
- **Retence**: PrintJob i UsbFileEvent se mažou s `RAW_RETENTION_DAYS`
  (default 35 dní, stejně jako surové intervaly aktivity).
- **Frontend**: nový tab „Tisk & USB" v navigaci (ikonka Printer), 2 záložky
  v rámci viewu (tisk / USB), top-N tabulka s drill-down detailem na uživatele.
  Bannery upozorňují, když je sběr vypnut nebo když se neukládají názvy.
- **Agent (.NET, v0.3.0)**: nové třídy PrintMonitor.cs a UsbMonitor.cs.
  Print: `EventLogWatcher` na `Microsoft-Windows-PrintService/Operational`
  event 307 (Document printed); flush každých 5 min.
  USB: `FileSystemWatcher` na všech aktivních removable discích + WMI
  `Win32_VolumeChangeEvent` pro detekci nově připojených zařízení.
  Obě respektují CapturePrintDocName / CaptureUsbFilename z registry –
  pokud OFF, název se vůbec neodešle. Server pak ještě jednou kontroluje
  (defense in depth).
- **MSI**: nové properties TRACKPRINT, CAPTUREPRINTDOCNAME, TRACKUSB,
  CAPTUREUSBFILENAME (default 0). Zápis do `HKLM\SOFTWARE\WorkView`.
- **Právní šablony**: aktualizován `08-pravni-manual.md` a
  `01-informace-zamestnancum.md` – tabulka rozsahu sledování, dovolené /
  omezené formy. Nové sběry vyžadují aktualizovaný balanční test a DPIA.
- **i18n**: nová sekce `printUsb.*` ve všech 5 jazycích + 10 nových klíčů
  v `settings.*` pro toggles. Lokalizace názvů ve sidebaru: "Tisk & USB" /
  "Tlač & USB" / "Print & USB" / "Drukowanie & USB" / "Druck & USB".



### Release-prep audit – security & GDPR sweep

Připraveno na placený pilot u 1–2 vybraných zákazníků (after lawyer review of `docs/pravni/`).

#### Bezpečnost
- **Per-device enrollment tokeny** (S4) – sdílený `INGEST_TOKEN` už není dlouhodobý sekret.
  Nový `POST /api/v1/ingest/enroll` vrátí per-device token, agent ho ukládá do
  `HKLM\SOFTWARE\WorkView\DeviceToken`. Únik z jednoho PC nezpřístupní data ostatních.
  Bezvýpadkově kompatibilní s legacy agenty.
- **Admin session do HttpOnly + Secure + SameSite=Strict cookie** (S2) – token
  není dosažitelný z JS, SameSite=Strict eliminuje CSRF u většiny scénářů.
- **Self-service token mimo URL query** (S1) – posílá se v `Authorization: Bearer`
  headeru, na klienta agent posílá přes URL fragment `#selfToken=…`, který
  frontend okamžitě přesune do `sessionStorage` a uklidí z historie prohlížeče.
- **TLS guard v C# agentovi** (S3) – `AllowInsecureHttp` musí být explicitně true
  pro http:// URL kromě localhostu. TLS 1.3 přidáno k 1.2.
- **Fail-fast v produkci** (S5) – server odmítne start s defaultními secrets
  (`admin`, `zmente-me`, `dev-token`, `__set_before_first_run__`, INGEST_TOKEN
  pod 24 znaků). `.env.example` přepsán bez funkčních defaultů.
- **CSP + HSTS** (S6) – `script-src 'self'` bez unsafe-inline, `base-uri 'none'`,
  `form-action 'self'`, HSTS 1 rok v production, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Immutable adminId v audit logu** (S10) – `AccessAudit.adminId` (cuid)
  vedle snapshotu username, takže přejmenování/smazání admina nemažou audit stopu.
- **Rate limit /api/v1/self/*** (S9) – 60 req/min/IP, chrání proti brute-force HMAC tokenu.
- **Cuid validace URL parametrů** – `:id` a `:deviceId` validovány Zodem před
  vstupem do Prisma findUnique.

#### GDPR & právo
- **GDPR čl. 17 – Právo na výmaz** (G1): `DELETE /api/v1/admin/users/:id?confirm=DELETE`
  smaže všechny aktivity, agregáty, absence, kalendář; profil pseudonymizuje
  (SID → hash, displayName → „Smazaný uživatel", nullable HR pole). Audit
  přístupů zůstává (forenzní záznam).
- **GDPR čl. 20 – Právo na přenositelnost** (G1): `GET /api/v1/admin/users/:id/export`
  i self-service `GET /api/v1/self/export` vrátí JSON dump všech známých údajů.
- **Retence DailyStat + DailyAppStat + AccessAudit** (HW5/HW6) – předtím rostly
  donekonečna (GDPR čl. 5/1/e). AccessAudit má vlastní `AUDIT_RETENTION_DAYS`
  (default 365).
- **Právní dokumenty** (G2):
  - `docs/pravni/04-dpa-vzor.md` — Data Processing Agreement
  - `docs/pravni/05-privacy-policy.md` — Privacy Policy / Zásady ochrany OÚ
  - `docs/pravni/06-rrpp-vzor.md` — Záznam o činnostech zpracování (čl. 30 GDPR)
  - `docs/pravni/07-incident-response.md` — Plán reakce na bezpečnostní incident
- **Informační banner v Nastavení** (HW4) – admin vidí, co FOCUS sbírá,
  s explicitním upozorněním na opt-in `CAPTURETITLE` a odkaz na šablonu §316 ZP.

#### Provoz a observability
- **Structured logger** (`src/logger.ts`) – JSON v production, barevný human-readable v dev,
  bez nové dependency. API kopíruje pino.
- **Prometheus `/api/v1/metrics`** – čítače HTTP, ingest, login, audit; gauges
  pro active devices a users; histogram response time.
- **`DEPLOY.md`** – produkční nasazení (Docker Compose vzor s Caddy reverse proxy,
  Postgres, zálohy, rollback, hardening checklist).

#### Licence & supply chain
- **`NOTICES.md`** – plný inventář runtime dependencí backendu, frontendu a .NET
  agenta s licencemi. JSZip dual MIT/GPL explicitně jako MIT.
- **CI license guard** – krok `License guard` v `monitoring-ci.yml` selže,
  pokud někdo v budoucnu instaluje dependenci pod GPL/LGPL/AGPL nebo jinou
  licencí mimo whitelist (záchytná síť proti supply-chain copyleft driftu).

#### Drobnosti
- Verze sjednoceny na 0.2.1 napříč (Watchdog byl 0.1.0).
- Demo HW snapshoty se backfillují JEN při `ENABLE_DEMO_DATA=true` (default false v produkci).
- Agent log na disku má rotaci (1 MiB → agent.log.1).
- Frontend ErrorBoundary – runtime chyba v komponentě už nesmaže celý dashboard.
- Heartbeat každý send-interval – log agenta doteče do dashboardu i mimo aktivitu.

### Přidáno (pilot)
- **`INSTALL-PILOT-WINDOWS.md`** — průvodce „klikni a běž" pro jeden testovací
  Windows PC: server v Dockeru (přes `start-demo.bat`), agent natvrdo přes MSI,
  vč. instrukcí pro odinstalaci starých verzí agenta.
- **Persistent volume** v `docker-compose.demo.yml` (volume `focus-db`
  mountnutý na `/data`) — data SQLite přežijí `docker compose down` i restart
  hostitelského PC. Pro úplně čistý start `down -v`.
- **`INGEST_TOKEN=dev-token`** explicitně v Dockerfile.demo, aby ladil
  s defaultní hodnotou v `install-agent-test.bat`.

### Opraveno (agent)
- **Resume-from-sleep handler** v agentovi: po probuzení Windows ze spánku
  (typicky víkend s laptopem zavřeným) agent zahodí mrtvý HTTP klient
  (zavře keep-alive sokety přes `ServicePoint.CloseConnectionGroup`) a po
  5 s odešle nashromážděný buffer. Dříve agent po dlouhém spánku „mlčel",
  protože jeho navázaná TCP spojení byla mrtvá, ale proces o tom nevěděl.
  Vyžaduje rebuild MSI.

### Přidáno
- **HW monitoring pro IT** — nová tabulka `DeviceHealth`, ingest endpoint
  `POST /api/v1/ingest/health`, výpočet stavu (OK / WARN / CRITICAL) podle
  pravidel pro SMART, baterii, RAM, disk, antivirus a aktualizace.
  Nová záložka „IT – zdraví zařízení" v dashboardu.
- **Per-oddělení výjimky klasifikace** — nová tabulka `DeptClassification`
  a UI v Nastavení; seedovaná výchozí pravidla (LinkedIn = WORK pro
  Personalistika / HR / Nábor).
- **Focus sessions a osobní trendy** v reportu zaměstnance — počet 25+ min
  bloků hluboké práce, nejproduktivnější hodina dne, srovnání tento týden
  vs minulý.
- **Domain-only režim** — volitelně ukládat z prohlížeče jen doménu místo
  celého titulku okna (lepší soukromí, klasifikace funguje dál).
- **Retenční politika** — nastavitelná retence syrových intervalů s denním
  background úklidem; agregáty zůstávají.
- **Self-audit panel** — volitelný panel „Kdo se na moje data díval" pro
  zaměstnance (GDPR čl. 15); samostatný přepínač.
- **Datalist oddělení** v editaci uživatelů — předvolby běžných českých
  oddělení + již používaná.
- **Demo HW seed** — při startu se vygenerují realistické snapshoty pro
  ukázková zařízení, aby IT dashboard hned něco ukázal.
- **Přepínač „zobrazit demo data"** — schová demo záznamy z dashboardu i
  exportů.

### Změněno
- **Přejmenováno na FOCUS** (uživatelský brand). Vnitřní názvy
  (.NET namespace, registry, ProgramData cesta) zůstávají `WorkView`
  z důvodu zpětné kompatibility.
- LinkedIn přesunut do vlastní kategorie (z „Sociální sítě"), aby šel
  per-oddělení přepsat.
- Zábavná kategorie přejmenována z „Mimopracovní" na **„Zábava"** napříč
  UI (interní enum `NON_WORK` zůstává).

### Opraveno
- Cyklické přepočítávání některých dashboard pohledů při změně klasifikace
  (přidána invalidace cache).

## [Starší verze]

- Bloky 1–7 vývoje viz `docs/STAV-A-NASAZENI.md`.
