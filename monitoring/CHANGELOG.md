# Changelog

Všechny významné změny jsou tady. Formát: [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verzování: [Semantic Versioning](https://semver.org/lang/cs/).

## [Unreleased]

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
- **Přejmenováno na Device Monitor** (uživatelský brand). Vnitřní názvy
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
