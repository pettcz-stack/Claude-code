# Nápady, vylepšení a „nice to have" (živý backlog)

Trvalý seznam, ze kterého bereme práci. Doplňuj/škrtej dle priorit.

---

## 0. PRIORITA: Detekce schůzky BEZ Outlooku

Problém: když je člověk na schůzce/callu, je mimo PC nebo nečinný → systém by to
mohl počítat jako „flákání". Outlook se realizovat nebude. Řešení bez Outlooku:

### A) Auto-detekce konferenčního hovoru (doporučeno, primární)
Agent rozpozná, že **běží hovor** v konferenční aplikaci, a daný čas označí jako
**„Schůzka" (práce)**, ne jako nečinnost. Bez mikrofonu/kamery – jen podle
procesu a titulku okna:
- **Teams** (`ms-teams.exe`/`Teams.exe`) – okno hovoru má titulek typu
  „Schůzka | Microsoft Teams", „… | Hovor".
- **Zoom** (`Zoom.exe`) – „Zoom Meeting".
- **Google Meet / Webex / Slack huddle** – titulek v prohlížeči („Meet – …",
  „Webex Meeting", „Huddle").
- Vylepšení: detekovat call i když **není v popředí** (člověk se dívá do
  podkladů) – agent projde okna (EnumWindows) a hledá titulek hovoru; pokud
  existuje, aktuální „nečinnost" se přepíše na „Schůzka".
- Konfigurace: editovatelný seznam „meeting" pravidel (jako WebRule, nový typ
  `MEETING`). Čas v hovoru → kategorie Schůzka, typ práce; nepočítá se do
  mimopráce ani do „mimo PC = flákání".

### B) Manuální označení (doplněk, fallback)
- Rychlé označení „Jsem na schůzce/jednání" – buď zaměstnanec (1 klik), nebo
  manažer zpětně označí blok. Vhodné pro offline jednání mimo PC (porada v
  zasedačce, u zákazníka).
- Lze napojit na jednoduché „důvody nepřítomnosti" se schválením manažerem.

### C) Heuristika týmové nečinnosti (volitelné, slabší)
- Když je více lidí z oddělení současně nečinných ve stejném okně → pravděpodobně
  týmová porada. Jen jako indikátor, ne tvrdé pravidlo.

> Doporučení: nasadit **A) + B)**. A pokryje online cally automaticky, B pokryje
> offline jednání. Tím se „mimo PC kvůli schůzce" přestane počítat jako flákání.

---

## 1. Analytika a metriky
- **Skutečný fond** = očekávaný fond − dovolená/nemoc (OKbase) − schůzky → spravedlivější skóre.
- Hluboká práce: nejdelší soustředěný blok, počet „deep work" bloků za den.
- Anomálie: náhlý propad výkonu u člověka/oddělení → upozornění.
- Srovnání dvou lidí / dvou období vedle sebe.
- Týdenní/měsíční **PDF report** s automatickým rozesláním manažerům.
- Auto-učení kategorií aplikací (návrh kategorie u neznámé aplikace).
- „Aktivní okno dne" za oddělení (agregovaně) – kdy tým reálně začíná/končí.

## 2. Motivace a zaměstnanci
- **Self-service login pro zaměstnance** (vidí jen svá data) – posiluje důvěru i právní obhajitelnost.
- Soutěž **„Zaměstnanec měsíce"**, týmové výzvy, série (streaky), osobní cíle.
- Více obsahu do režimů: zábavný (odznaky, mfilníky), zdravotní (rozšířit tipy),
  rozvojový (více citátů, vlastní firemní moudra).
- Pozitivní notifikace („dnes ses zlepšil o X %").

## 3. Bezpečnost a enterprise
- **Per-device tokeny** (hash v DB) místo sdíleného ingest tokenu.
- **2FA** pro admina, **AD/SSO** přihlášení.
- **Manažerské role** – vidí jen své oddělení.
- Automatizované šifrování v klidu, rotace tajemství, exporty auditu.

## 4. Provoz a nasazení
- Verzované **PostgreSQL migrace** (nyní `db push` v Dockeru).
- **Self-update agenta**, dashboard zdraví agentů („verze X na Y PC").
- Code-signing pipeline pro MSI, podepsané buildy.
- Flat ESLint config (eslint v9+), code-splitting dalších stránek.

## 5. Integrace
- **OKbase** – HO/dovolená/nemoc (Fáze 2, čeká na přístupy).
- ~~Outlook kalendář~~ – **zrušeno**, nahrazeno detekcí schůzek (viz sekce 0).
- (Volitelně) Teams presence, HR/docházkové systémy.

## 6. UX / lokalizace
- Časové pásmo **Europe/Prague** pro trendy a heatmapu (nyní UTC).
- Uložené filtry, onboarding/nápověda, plná responzivita pro mobil/tablet.

## 7. Právo / GDPR
- Vyřízení žádostí subjektu (export/výmaz dat zaměstnance) z UI.
- Evidence rozdání informace o monitoringu a souhlasů/poučení.
- Nastavitelná retence přímo v UI.
