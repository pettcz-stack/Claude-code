# Changelog

Všechny významné změny jsou tady. Formát: [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verzování: [Semantic Versioning](https://semver.org/lang/cs/).

> **Jak číst:** v každé verzi je shrnutí jako TL;DR + 4 sekce: 🆕 Přidáno · 🔧 Opraveno · 🚀 Výkon · 🛡️ Bezpečnost.
> Detaily jednotlivých commitů: `git log v0.9.X..v0.9.Y` nebo na GitHubu v Releases.
> **Proces vydání:** [docs/RELEASING.md](docs/RELEASING.md).

## [Unreleased]

## [0.9.3] — Realistická demo data + detekce podvádění — 2026-05-28

**TL;DR:** Generální oprava demo datasetu na 1991 zaměstnanců aby vypadal jako reálná firma:
skóre šplhalo z **2 %** na realistických **50-65 %** (15-min intervaly měly špatnou škálu),
přidáno **20 uživatelů s software pro obcházení monitoringu** (mouse jiggler, AHK, Caffeine,
Process Hacker) + **60 lidí s aktivitou po 21:00**, HO dip kalibrovaný dle výzkumu (Stanford,
McKinsey, ActivTrak) na −18 %, performance optimalizace (alerts + heatmap caching, bulk
integrity = 100× rychlejší).

### 🆕 Přidáno
- **Detekce obcházení monitoringu** — nový alert `EVASION_SOFTWARE` (high/medium)
  - 10 aplikací v kategorii „Obcházení monitoringu" (mouse_jiggler.exe, move_mouse.exe,
    autohotkey.exe, caffeine.exe, noscreensaver.exe, keep_alive.exe, desktop_wiggler.exe,
    autoclicker.exe, mousekey.exe, process_hacker.exe)
  - 20 uživatelů s narativem: mouse jiggler během oběda/schůzek, AHK skript v Teams callech,
    Caffeine při CAD renderu, Process Hacker = pokus o killnutí agenta
  - Detekce ≥ 10 min = medium, ≥ 60 min = high (+ DailyStat.suspicious=true)
  - Pozn.: Toto NENÍ piracy/license audit – je to **detekce úmyslného podvádění**.
- **After-hours activity** — nový alert `AFTER_HOURS_ACTIVITY` (medium)
  - 60 uživatelů s aktivitou 21:00-05:00 (cheateři non-stop, IT on-call, manažeři)
- **10 person** místo 4: top, normal, chatty, social_media, streamer, gamer, slacker,
  ghost (výroba/sklad), absent_frequent, sales_road, manager_busy + 3 typy cheaterů
- **CZ státní svátky** v seedu — žádná aktivita na svátek
- **Víkendová aktivita** ~6 % firmy (IT support, on-call, workaholici)
- Per-day quality hash (každý má dobré/špatné dny) × per-user consistency
- Hodinová křivka (warmup → peak → lunch → peak → wind-down)
- Lunch break per-person ±30 min
- Early birds (7-15) / normal / pozdě (9-17)
- Kontinuální dovolené (5 dní v kuse) místo random 1-denních

### 🔧 Opraveno
- **Skóre 2 % bug**: `intervalSeconds: 60` v seedu znamenalo max 32 min/den aktivity
  (32 intervalů × 60 s). Změna na `intervalSeconds: 900` = skutečných 15 min.
- **Integrity threshold**: `>= 30` v nové škále 900s znamenalo jen 3 % aktivních →
  cheateři nedetekováni. Nyní relativní `activeSeconds × 2 >= intervalSeconds`.
- **DEPT_PLAN suma 2114 → 1991** (uživatel chtěl přesně tolik)
- **Číslice u jmen**: bug v `genPeople` přidával číslo všem (po `used.add() + break`
  byl `used.has(name)` vždy true).
- **Admin login po seedu**: `ensureAdmin` kontroloval `count > 0`, ale seed vytváří
  6 manažerských účtů → default `admin` se nikdy nevytvořil. Fix: kontrola podle username.
- **After-hours sample marker** používal `mimikatz.exe` který už existuje díky piracy
  seedu → after-hours se nikdy neseedoval. Fix: COUNT po 19 UTC.

### 🚀 Výkon
- **`firstSeenInRange`**: groupBy `ActivityInterval` (1.4M) → `DailyStat` (44k). 30× rychlejší.
- **Heatmap**: scan `ActivityInterval` → `ActivityHourly` (4× rychlejší).
- **`detectAlerts`**: 1991 sekvenčních findMany → 1× bulk. **100× rychlejší /alerts**.
- **`aggregateAllFast`**: integrity reuse intervals z hlavní smyčky (0 extra queries vs 44k).
- **Cache**: alerts + heatmap v `cachedQueries` (5 min TTL), warm cache při startu.
- **Bulk seed agregace** ~ 1 min místo dříve > 90 min pro 1.4M intervalů.

### 🛡️ Bezpečnost
- HO efficiency dip kalibrovaný dle peer-reviewed výzkumu (ne nahozeno z hlavy):
  Stanford Bloom 2015 (+13 % call centre), McKinsey 2020 (−20 % brzy po pandemii),
  ActivTrak 2023 (−8 % průměr), Microsoft WTI 2023 (focus neutral, coordination dolů)

## [0.9.2] — Pilot iterace (UX + výkon + macOS) — 2026-05-27

**TL;DR:** Po reálném pilotu na macOS přibylo cca 30 commitů. Hlavní vlna: dotažení
macOS agenta (`.app` bundle, ad-hoc codesign, Input Monitoring detekce, baterie health),
sjednocení statistiky napříč pohledy (pro nově nasazeného uživatele už dashboard
nezobrazuje 160 h "Mimo PC"), Developer Mode s metodikou u každé metriky,
sort/filter/pagination ve všech velkých tabulkách, lazy-loading frontendu
(-31 % initial bundle), one-shot macOS installer skript.

### 🆕 Přidáno

#### Agent macOS
- **`.app` bundle** s `CFBundleIdentifier=com.sinsu.focusagent` + ad-hoc codesign.
  Bez něj měl macOS Sequoia 26 problém: každý rebuild = nový CDHash = TCC reset
  povolení Input Monitoring / Accessibility. S bundlem si TCC zapamatuje
  uživatelovo schválení napříč updaty.
- **`install-mac.sh`** — one-shot instalátor (stáhne pkg, ověří buildId, vyčistí
  starou binárku, otevře System Settings panely, restartne agenta a ověří
  permissions v logu).
- **IOHIDCheckAccess** detekce před `CGEvent.tapCreate` — agent v logu jasně
  řekne, zda je Input Monitoring `povolen` / `ODMÍTNUT` / `není ještě rozhodnut`
  (dřív tap "nainstalován" ale úhozy = 0 a uživatel netušil proč).
- **Baterie zdraví + cykly** přes `ioreg AppleSmartBattery` (drive jen `pmset -g batt`).
- **Fáze 2 typingKpm** — agent měří souvislé typing sessions s gap < 5 s,
  posílá `typingMs` + `typingKeystrokeCount`. Backend pak počítá tempo psaní
  jen z aktivního psaní (eliminuje pauzy mezi větami).
- **Smoke-test script** `Scripts/smoke-test-macos.sh` — diagnostika 8 oblastí
  (binárka, launchd, config, backend reachability, TCC permissions, logy, device token).
- **Build ID v logu** — `FOCUS agent macOS 0.9.2 build 2026-05-27-... startup`.

#### Backend
- **Cílená reagregace** klasifikace (`reaggregateByClassificationChange`) místo
  `aggregateAll()` – při změně `chrome.exe` → WORK se přepočítají jen intervaly
  s tímto appName (~5 %), ne miliony řádků celé firmy.
- **Detailnější `/api/v1/health`** — vrací `{ status, uptime, version, checks: { db, memory } }`.
  Uptime monitor (Uptime Kuma) si rozliší ok / degraded podle 503.
- **typingMs + typingKeystrokeCount** v `ActivityInterval` a `DailyStat` (Prisma migrace 20260527153306).
- **firstSeenInRange + computeExpectedMinutes + buildExpectedOf** helpers v `analytics.ts`
  — jednotná logika pro všechny analytické funkce (overview, scoreboard,
  homeOffice, monitorsComparison, costAudit, selfReport, computeUserScore).

#### Frontend
- **Developer Mode** (toggle v UserMenu pro ADMIN, persistován v localStorage):
  zobrazí ⓘ ikonky vedle metrik s tooltipy vysvětlujícími metodiku výpočtu.
  Nasazeno na ~15 klíčových metrik v Overview, ScoreView, HeatmapView,
  HomeOffice, SoftwareView.
- **Sort + filter v hlavních tabulkách** přes sdílený `useSort` + `<SortHeader>`
  (Shrnutí, IT Health, Home-office, Tisk/USB, Software, Přístupy). LocaleCompare
  s `cs` lokalizací rozumí `Č`, `Š` a číslům v textu.
- **Pagination** (50/strana) ve Shrnutí, HW Health, Přístupy přes `usePagination`.
- **Empty states s onboarding CTA** — pokud žádné zařízení, zobrazí se
  "Stáhnout agenta" tlačítko místo prázdných 0/0 KPI karet.
- **TypePicker** v Klasifikaci — kliknutí na chip otevře dropdown pro inline
  reklasifikaci (Práce / Zábava / Neutrální / Nezařazeno). Prohlížeče
  (Chrome, Safari, …) mají chip "podle webu" — klasifikace přes WebRule.
- **Reagregace při změně pravidla** — backend přepočítá dotčené dailyAppStat,
  Top weby / aplikace se okamžitě aktualizují.
- **Heatmap + Trend bez budoucnosti** — dny po `now` jsou neměřitelné
  (transparentní, ne 0 % bar). Pro dny před nasazením agenta totéž (observed=0).
- **Sticky levé menu** při scrollu (lg+ breakpoint).
- **Vlastní (custom) date range** přes nativní `<input type="date">`.
- **macOS app icons** ~60 + emoji barev (Google Chrome, Safari, Terminal,
  Slack, Discord, Xcode, Cursor, Notion, Figma, Spotify, Claude, …).
- **Top weby z titulku okna** — backend extrahuje doménu regexem
  (`youtube.com`, `github.com`, …) z titulku Chrome / Safari, pokud
  Accessibility povolena.

#### Operace
- **Docker log rotation** (max 10 MB × 3 soubory per kontejner) v obou
  compose souborech.
- **DEPLOY.md aktualizován** s Prometheus scrape config + 5 doporučenými alerty
  (backend down, žádný ingest, brute force, vysoká chybovost, málo zařízení).
- **CHANGELOG + RELEASING.md proces** — verze se bumpuje při každém GA pushe,
  release-notes do GitHub Releases automaticky z CHANGELOG.

### 🔧 Opraveno

- **"Mimo PC: 160 h"** u nově nasazeného uživatele — expected work minutes
  nyní clampnuté na `min(workdays × 8h, uplynulé minuty od prvního intervalu)`.
- **`windowTitle: null`** odmítáno backendem (Zod `.optional()` neumí `null`)
  — schema změněno na `.nullish()`, agent macOS nyní podmíněně nepřidává
  null fieldy.
- **macOS browsers** (`Google Chrome`, `Safari`, …) nebyly v `BROWSERS` setu
  pro aggregate.ts — top weby na Macu byly vždy prázdné. Refactor přes
  sdílený `isBrowser()` z `domain.ts`.
- **Self-delete admina** — UI trash button disabled pro vlastní řádek
  + tooltip "Vlastní účet nelze smazat".
- **Print/USB demo data viditelná i po vypnutí toggle** — `printSummary` /
  `usbSummary` měly špatnou check klauzuli (`'id' in userFilter`),
  filter se neaplikoval. Refactor přes `hiddenDemoUserIds()`.
- **Skrytý drill-down** v Tisk & USB tabulkách — chyběl vizuální indikátor.
  Přidán `›` chevron + emerald hover.
- **Seed sentinel** bumpnut na `.seeded-v2` — uživatelé bez `down -v`
  dostanou Print/USB data po upgrade image.
- **Schéma v `dist/seed.js`** — `skipDuplicates` SQLite nepodporuje,
  místo toho idempotentní check `count() === 0`.
- **Stale TCC** po reinstall agenta — codesign + tccd HUP v postinstallu
  + dokumentace v install skriptu.

### 🚀 Výkon

- **Initial bundle frontend −31 %** (468 KB → 320 KB) díky `React.lazy`
  na všech tabech kromě OverviewView a Scoreboard.
- **Cílená reagregace** — místo 2.7 M řádků jen ~5 % dotčených (chrome.exe).
- **Pagination 50/strana** ve velkých tabulkách — render < 50 řádků místo všech.

### 🛡️ Bezpečnost

- **`assertProductionSecrets`** rozšířen — odmítá start s SQLite v produkci,
  CORS=`*`, SMTP_SECURE=false na nepodporovaných portech. Výpis důvodů
  v hezky formátovaném box-drawing.
- **Per-user expected** s clampem na `firstSeenAt` napříč všemi pohledy
  (defense in depth proti unfair score pro nově nasazené).

### 📦 Verze komponent v 0.9.2

| Komponenta | Verze |
|---|---|
| Backend (`monitoring/backend/package.json`) | 0.9.2 |
| Frontend (`monitoring/frontend/package.json`) | 0.9.2 |
| Agent macOS (`AgentInfo.swift`) | 0.9.2 |
| Agent Windows (`AgentInfo.cs`) | 0.9.1 *(bez změn)* |
| Prisma migrace | `20260527153306_typing_kpm_phase2` |

## [0.9.1] — Release-candidate (pilot-ready)

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
