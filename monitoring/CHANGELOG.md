# Changelog

Všechny významné změny jsou tady. Formát: [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verzování: [Semantic Versioning](https://semver.org/lang/cs/).

## [Unreleased]

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
