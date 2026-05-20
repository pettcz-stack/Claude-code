# Návrh řešení: Monitoring pracovní aktivity na firemních zařízeních

> **Pracovní název:** WorkView (lze přejmenovat)
> **Stav:** Návrhový dokument k odsouhlasení. Žádný kód se zatím nepíše.
> **Účel dokumentu:** Slouží jako kostra, podle které se bude stavět po částech (viz §12 Roadmap).

---

## 1. Cíl a rozsah

Vytvořit interní nástroj, který zaměstnavateli umožní v souladu s § 316 zákoníku práce sledovat **využití firemních pracovních zařízení** — tj. zda u počítače probíhá práce, v jaké aplikaci, jestli je uživatel aktivní nebo nečinný, a jaké je tempo psaní (úhozy/min).

**Co řešení dělá:**
- Lehký agent na firemních Windows PC sbírá **agregované** metriky aktivity.
- Centrální backend data ukládá a agreguje po hodinách.
- Webový dashboard zobrazuje **kalendář s hodinovým rozpadem** aktivity každého uživatele.
- Distribuce přes `.msi` instalátor a **GPO (Active Directory)** — tichá vzdálená instalace.
- Architektura připravená na budoucí napojení **OKbase** (absence/HO/dovolená) a **Outlook/Exchange** (meetingy).

**Platformy:**
- **Agent: Windows — musí fungovat na všech podporovaných verzích** (Win 10/11 i starší dle potřeby, a **Windows Server**). Viz §5 — volba cílového frameworku kvůli maximální kompatibilitě.
- **macOS: agent NE.** Na Macu stačí přístup k **dashboardu přes zabezpečené webové rozhraní** (dashboard je web → funguje v prohlížeči na jakémkoli OS včetně macOS).

**Co řešení vědomě NEdělá** (právní + etické hranice, viz §2):
- ❌ Žádné screenshoty / záznam obrazovky
- ❌ Žádný keylogging obsahu (NEukládá, *které* klávesy se zmáčkly ani co se píše)
- ❌ Žádné čtení e‑mailů, zpráv, souborů, schránky
- ❌ Žádné sledování souřadnic myši ani obsahu oken
- ❌ Žádné skryté/utajené sledování — agent je viditelný a zdokumentovaný

---

## 2. Právní rámec a jeho dopad do návrhu (ČR + GDPR)

Zaměstnavatel má dle **§ 316 odst. 1 ZP** právo přiměřeně kontrolovat využití pracovních prostředků (vč. výpočetní techniky). **§ 316 odst. 2** zakazuje narušování soukromí obsahovým sledováním (odposlech, čtení e‑mailů/pošty). Z toho plynou tvrdé designové mantinely:

| Zásada | Konkrétní dopad do kódu |
|---|---|
| **Proporcionalita / minimalizace** | Sbírají se jen agregované metriky za interval, ne syrová data. Žádný obsah. |
| **Transparentnost (žádné skryté sledování)** | Agent má viditelnou identitu (proces, ikona/notifikace, v Programech a funkcích). Zdokumentace pro zaměstnance. |
| **Účelové omezení** | Data slouží jen k vyhodnocení využití pracovní doby/prostředků. |
| **Retence** | Konfigurovatelná doba uchování; automatické mazání starých dat. |
| **Právní titul = oprávněný zájem** | Ne souhlas (slabý titul u zaměstnanců). Připravit balanční test. |

**Nejcitlivější metrika — klávesnice.** Hranice:
- ✅ **Počet úhozů za interval → úhozy/min** (čistá metrika tempa). Agent drží jen čítač, který se po odeslání resetuje.
- ❌ **Které klávesy / obsah** = keylogging = nelegální. **Implementačně vyloučeno** — agent nikdy neukládá scan‑kód ani znak.

Totéž myš: ✅ počet pohybů/kliků za interval, ❌ souřadnice/obsah.

**Organizační povinnosti zaměstnavatele (mimo software, ale dodáme šablony):**
- Předem prokazatelně **informovat zaměstnance** (rozsah, způsob, účel).
- **DPIA** (posouzení vlivu) — u systematického monitoringu se prakticky vyžaduje.
- **Záznam o činnostech zpracování**, informování zástupců zaměstnanců.

> Tyto šablony (informace pro zaměstnance, podklad DPIA, balanční test oprávněného zájmu) dodáme jako součást Fáze 1 v `docs/monitoring/pravni/`.

---

## 3. Sbíraná data (přesná specifikace)

Agent pracuje v **intervalech** (výchozí 60 s). Za každý interval pošle jeden záznam:

| Pole | Typ | Popis | Jak se získá |
|---|---|---|---|
| `interval_start` | timestamp | začátek intervalu (UTC) | hodiny agenta |
| `device_id` | string | ID zařízení | strojové ID / GPO config |
| `user_sid` | string | Windows SID uživatele | session |
| `active_seconds` | int (0–60) | sekundy aktivity (ne‑idle) | `GetLastInputInfo` (idle threshold) |
| `idle_seconds` | int (0–60) | sekundy nečinnosti | dopočet |
| `foreground_app` | string | název procesu/exe aktivní aplikace | `GetForegroundWindow` → proces |
| `app_category` | string? | volitelná kategorie (práce/komunikace/…) | mapování na backendu |
| `keystroke_count` | int | **počet** úhozů za interval | čítač z low‑level hooku (jen inkrement) |
| `mouse_events` | int | **počet** pohybů+kliků za interval | čítač |
| `session_locked` | bool | byla obrazovka zamčená | session notifikace |

**Z `keystroke_count` a délky aktivního času** se na backendu počítá **úhozy/min** (KPM) a klouzavý průměr.
**Window title se NESBÍRÁ** (riziko osobních dat). Pokud by se v budoucnu chtěl, jen přes whitelist a po novém DPIA.

---

## 4. Architektura (přehled)

```
┌─────────────────────────┐         HTTPS (mTLS/token)        ┌──────────────────────┐
│  Windows endpoint        │  ─── POST /api/v1/ingest ───►    │  Backend (API)        │
│  ┌────────────────────┐ │     (dávky intervalů, JSON)       │  ┌─────────────────┐  │
│  │ User-session agent │ │                                   │  │ Ingest service   │ │
│  │  - idle detekce    │ │                                   │  │ Agregace (hod.)  │ │
│  │  - aktivní app     │ │                                   │  │ Retence/mazání   │ │
│  │  - čítač kláves    │ │                                   │  └────────┬────────┘  │
│  │  - čítač myši      │ │                                   │           │            │
│  │  - lokální buffer  │ │                                   │      ┌────▼─────┐      │
│  └────────────────────┘ │                                   │      │   DB     │      │
│  (volitelně: updater    │                                   │      └────┬─────┘      │
│   služba pro upgrade)   │                                   │           │            │
└─────────────────────────┘                                   │      ┌────▼─────────┐ │
                                                               │      │ Dashboard API│ │
   Budoucí adaptéry (Fáze 2/3):                                │      └────┬─────────┘ │
   - OKbase  → absence/HO/dovolená  ──────────────────────────►           │            │
   - Outlook/Exchange → meetingy    ──────────────────────────►  ┌────────▼─────────┐ │
                                                               │  │  Web dashboard   │ │
                                                               │  │  kalendář + hod. │ │
                                                               └──┴──────────────────┴─┘
```

---

## 5. Endpoint agent (Windows) — detailní návrh

- **Jazyk:** C#/.NET (nativní pro Windows + WiX MSI).
- **Kompatibilita Windows (požadavek „všechny verze"):** cílit na široce dostupný runtime. Doporučení: agent psát proti **.NET Framework 4.8** (předinstalováno/dostupné na Win 10/11 i Server 2012R2+) **nebo** distribuovat jako **self‑contained .NET 8** (runtime zabalen v MSI, nezávislé na tom, co je na stroji). Rozhodnout v Bloku 1.4 dle nejstarší verze Windows, kterou reálně provozujete. API pro idle/foreground/input (`GetLastInputInfo`, `GetForegroundWindow`, Raw Input) jsou dostupná napříč všemi verzemi.
- **Model běhu:** agent **musí běžet v interaktivní session uživatele** (sběr vstupu nejde ze session 0). Spuštění přes **Scheduled Task při logon** (běží pod přihlášeným uživatelem). Volitelně doprovodná **Windows služba** (LocalSystem) pro správu konfigurace a self‑update.
- **Detekce aktivity:** `GetLastInputInfo` → idle čas (bez čtení obsahu vstupu).
- **Aktivní aplikace:** `GetForegroundWindow` → PID → název procesu. Bez titulku okna.
- **Čítače vstupu:** low‑level hook / Raw Input **pouze pro inkrementaci čítače**. Žádné ukládání kódu klávesy. Po odeslání intervalu reset na 0.
- **Buffer & odolnost:** lokální buffer (SQLite/soubor) pro případ výpadku sítě; odeslání dávkou, retry s backoffem.
- **Konfigurace:** registry klíč (plněný GPO/MST) — URL backendu, interval, ID firmy, token.
- **Viditelnost:** ikona v tray nebo úvodní notifikace „toto zařízení je monitorováno" (transparentnost).
- **Bezpečnost:** komunikace HTTPS, autentizace zařízení tokenem (příp. klientský certifikát/mTLS).

---

## 6. Backend — detailní návrh

- **Ingest API:** `POST /api/v1/ingest` — přijme dávku intervalů, validuje, uloží jako syrové intervaly (krátká retence) a zařadí k agregaci.
- **Agregace:** rollup intervalů → **hodinové** agregáty per uživatel (aktivní min, idle min, top aplikace, průměr KPM, počet meetingů z Outlooku ve Fázi 3, stav absence z OKbase ve Fázi 2).
- **Dashboard API:** čtení agregátů pro kalendář (filtry: uživatel, den/týden, oddělení).
- **Správa:** uživatelé/zařízení, role (admin/náhled), audit log přístupů (kdo se na čí data díval — důležité pro GDPR).
- **Retence:** plánovaná úloha maže syrová data po N dnech, agregáty po M měsících (konfigurovatelné).

### Datový model (návrh tabulek)
- `devices` (id, hostname, last_seen, enrollment_token_hash)
- `users` (id, sid, display_name, department, okbase_id?)
- `activity_intervals` (device_id, user_id, interval_start, active_s, idle_s, app, keystrokes, mouse_events, locked) — krátká retence
- `activity_hourly` (user_id, hour, active_min, idle_min, locked_min, top_app, avg_kpm, meeting_min?, absence_type?)
- `app_categories` (app → kategorie)
- `absences` (user_id, date, type) — Fáze 2 (OKbase)
- `calendar_events` (user_id, start, end, kind=meeting) — Fáze 3 (Outlook)
- `access_audit` (admin_user, viewed_user, timestamp, action)

---

## 7. Dashboard — detailní návrh

- **Hlavní pohled:** kalendář (den/týden) → pro vybraného uživatele **hodinový rozpad** (časová osa 0–24 h).
- **Vizualizace hodiny:** barevné pásmo dle dominantního stavu — *aktivní práce / nečinnost / zamčeno / meeting (Fáze 3) / HO‑dovolená (Fáze 2)* + tooltip s detaily (top aplikace, průměr KPM, % aktivního času).
- **Přehledy:** denní/týdenní souhrn na uživatele i oddělení; export (CSV/PDF).
- **Role & přístup:** admin vs. náhled; každý přístup k datům konkrétního zaměstnance se loguje (GDPR).
- **Vědomě chybí:** žádné „live" sledování obrazovky, žádné drill‑downy do obsahu — jen agregáty.

---

## 8. Instalátor a nasazení přes AD/GPO

- **Formát: `.msi` (WiX Toolset)** — doporučeno místo `.bat`. Důvody: nativní podpora **GPO Software Installation** (Computer Configuration → Assigned → tichá instalace bez interakce), upgrade/repair/uninstall zdarma, **MST transform** pro předkonfiguraci (URL backendu, token, ID firmy) bez úpravy MSI.
- **Postup nasazení (zdokumentujeme):**
  1. MSI na **UNC sdílení** čitelné pro účty počítačů.
  2. GPO → Computer Config → Policies → Software Settings → Software installation → New Package (UNC cesta) → **Assigned**.
  3. (Volitelně) MST transform s konfigurací serveru.
  4. „Always wait for the network at computer startup" kvůli spolehlivosti.
  5. Restart cílových PC → tichá instalace.
- **Odinstalace/upgrade:** přes GPO (nová verze MSI, upgrade code).
- **`.bat` varianta:** dodáme jen jako fallback (např. `msiexec /i ... /qn` wrapper), ale primární je MSI.

---

## 9. Bezpečnost

- HTTPS všude; autentizace zařízení (enrollment token, příp. mTLS).
- Princip nejmenších oprávnění; agent neběží zbytečně jako admin pro sběr.
- Šifrování dat v klidu (DB) a v přenosu.
- Audit log přístupů administrátorů k datům zaměstnanců.
- Žádná telemetrie mimo firmu (dle zvoleného hostingu).

---

## 10. Budoucí integrace (architektura už počítá)

- **OKbase (Fáze 2):** adaptér importuje absence (home office, dovolená, nemoc) → tabulka `absences`. Dashboard pak „nečinnost" v těchto dnech označí jako legitimní (ne jako lenošení). Napojení dle dostupného OKbase API/exportu (upřesní se).
- **Outlook/Exchange (Fáze 3):** adaptér (Microsoft Graph / EWS) čte **jen časy meetingů** (start/konec, ne obsah/účastníky nad rámec nutného) → tabulka `calendar_events`. Dashboard označí „mimo PC během meetingu" jako práci.

---

## 11. Technologický stack (návrh k potvrzení)

| Vrstva | Volba | Pozn. |
|---|---|---|
| Agent | **C#/.NET (Windows)** | nutné nativní |
| Instalátor | **WiX → .msi** | GPO friendly |
| Backend | ASP.NET Core *(nebo Node.js — dle tvé preference)* | rozhodnout |
| DB | PostgreSQL *(nebo SQL Server)* | rozhodnout |
| Dashboard | React + TypeScript *(nebo Blazor)* | rozhodnout |
| Hosting | On‑premise / privátní cloud EU | rozhodnout (GDPR) |

> Otevřená rozhodnutí: backend stack, DB, frontend, hosting. Doporučení: pro Windows/AD prostředí **.NET end‑to‑end + PostgreSQL + on‑premise**.

---

## 12. Inspirace z konkurence (DoZo / Dozorce 4)

Analyzováno z veřejných materiálů dozorce.com (spustitelné demo jsme záměrně **nestahovali ani nespouštěli** — obsahuje keylogger/screenshoty/mikrofon/kameru, tedy schopnosti, které odmítáme; navíc cizí spyware binárku nepouštíme).

**Co převzít (legální podmnožina) — kandidáti na roadmapu:**
- **Centrální hromadná správa agentů** — vzdálená správa instalací, jejich konfigurace, stavu a **verzí** z jednoho místa. Klíčové pro velké AD prostředí. → Blok 1.7 / nový modul.
- **Plánované e‑mailové reporty** — souhrn např. každé pracovní ráno. → Blok 1.8.
- **Volitelné uživatelské rozhraní pro sledovaného** — DoZo ho nabízí; pro nás je to ideální nástroj **transparentnosti** (§316: žádné skryté sledování). → součást agenta (Blok 1.4).
- **Edice/varianty** (HOME/BUSINESS/SERVER) — inspirace pro budoucí balení; teď neřešíme.
- **Podpora všech verzí Windows + Windows Server** — potvrzuje náš požadavek (§5).

**Co výslovně NEpřebíráme (za hranou §316 / GDPR):**
- ❌ Keylogger obsahu, ❌ screenshoty/záznam obrazovky, ❌ mikrofon, ❌ webkamera, ❌ vzdálené živé sledování obrazovky.

---

## 13. Roadmap — stavba po částech

Každý blok je samostatná, odsouhlasitelná dodávka. Stavíme až po tvém pokynu „pusť blok X".

**FÁZE 1 — MVP**
- **Blok 1.1** — Skeleton repo struktury nového produktu + datový model + DB migrace.
- **Blok 1.2** — Backend: ingest API + agregace na hodiny + retence.
- **Blok 1.3** — Dashboard: kalendář s hodinovým rozpadem (na mock/seed datech).
- **Blok 1.4** — Agent (C#/.NET): idle, aktivní app, čítače kláves/myši, buffer, odeslání.
- **Blok 1.5** — WiX `.msi` + dokumentace nasazení přes GPO (+ `.bat` fallback).
- **Blok 1.6** — Právní šablony: informace pro zaměstnance, podklad DPIA, balanční test.
- **Blok 1.7** — Role/přístup + audit log přístupů, export + **centrální správa agentů** (přehled instalací, konfigurace, verze).
- **Blok 1.8** — Plánované **e‑mailové reporty** (denní/týdenní souhrn).

**FÁZE 2 — OKbase**
- **Blok 2.1** — Adaptér OKbase (absence/HO/dovolená) + zobrazení v dashboardu.

**FÁZE 3 — Outlook**
- **Blok 3.1** — Adaptér Outlook/Exchange (meetingy) + zobrazení v dashboardu.

---

## 14. Otevřené otázky před stavbou

1. Backend stack: **.NET** vs **Node.js**?
2. DB: **PostgreSQL** vs **SQL Server**?
3. Frontend: **React** vs **Blazor**?
4. Hosting: **on‑premise** vs **privátní cloud (EU)**? (ovlivní síťový návrh agenta — HO uživatelé mimo firemní síť)
5. Interval sběru: výchozí **60 s** OK?
6. Retence: jak dlouho syrová data / agregáty?
7. Název produktu (zatím „WorkView").
8. OKbase — máte k dispozici API/export a dokumentaci?

---

*Tento dokument je živý — po odsouhlasení podle něj postavíme jednotlivé bloky.*
