# WorkView Agent (Windows)

Lehký agent sbírající **agregované** metriky pracovní aktivity a odesílající je
na backend. Běží v interaktivní session přihlášeného uživatele.

## Co sbírá (a co NE)

Sbírá: aktivní/nečinný čas, název aktivní aplikace (proces), **počet** úhozů a
**počet** myších událostí za interval, příznak uzamčení session, a volitelně
**titulek aktivního okna** (pro klasifikaci práce/zábava – viz `CaptureWindowTitle`).

**Nesbírá:** obsah kláves (žádný keylogging), souřadnice myši, screenshoty,
mikrofon, kameru. Soulad s §316 ZP a GDPR (viz `../../docs/monitoring/NAVRH.md`).
Titulek okna je osobní údaj – při zapnutí musí být pokryt informací pro
zaměstnance a DPIA (`docs/monitoring/pravni/`).

Hooky klávesnice/myši v `InputCounters.cs` pouze **inkrementují čítač** – kód
klávesy se záměrně nečte.

## Transparentnost

Agent zobrazuje ikonu v oznamovací oblasti s informací, že je počítač monitorován
(žádné skryté sledování).

## Konfigurace

Z registru `HKLM\SOFTWARE\WorkView` (plní MSI / GPO – Blok 1.5):

| Hodnota | Význam | Příklad |
|---|---|---|
| `BackendUrl` | URL backendu | `https://workview.firma.cz` |
| `IngestToken` | token pro ingest | `…` |
| `IntervalSeconds` | délka intervalu | `60` |
| `CaptureWindowTitle` | sbírat titulek okna (`1`/`0`) | `0` |

Pro vývoj lze použít proměnné prostředí `WORKVIEW_BACKEND_URL`,
`WORKVIEW_INGEST_TOKEN`, `WORKVIEW_INTERVAL_SECONDS`.

## Build (na Windows)

Vyžaduje .NET SDK (8+) s podporou `net48` nebo Visual Studio 2022 + .NET Framework 4.8 Developer Pack.

```powershell
cd monitoring/agent/WorkView.Agent
dotnet build -c Release
# nebo MSBuild:
msbuild WorkView.Agent.csproj /p:Configuration=Release
```

Výstup: `bin/Release/net48/"MA win 32.exe"`.

## Lokální test proti dev backendu

```powershell
$env:WORKVIEW_BACKEND_URL = "http://localhost:4000"
$env:WORKVIEW_INGEST_TOKEN = "dev-token"
$env:WORKVIEW_INTERVAL_SECONDS = "10"
.\bin\Release\net48\"MA win 32.exe"
```

Data se objeví v dashboardu po několika intervalech.

## Nasazení

Agent se spouští přes Scheduled Task při přihlášení uživatele; instalaci a
konfiguraci řeší MSI instalátor a GPO – viz Blok 1.5 (`../installer`).

## Výkon a nenáročnost

- Cíl **.NET Framework 4.8** (už součástí Windows) → `.exe` ~80–200 KB, MSI ~0,3–1 MB.
- Paměť ~10–30 MB RAM, CPU prakticky neměřitelné.
- Vzorkuje 1× za sekundu jen levné systémové dotazy (idle čas, titulek okna).
  **Název aktivní aplikace (proces) se zjišťuje jen při změně okna** – ne každou
  sekundu (drahá operace) → minimální CPU.
- Běží se **sníženou prioritou** (`BelowNormal`) – nesoupeří o CPU s prací uživatele.
- Žádné screenshoty/video/zvuk → nulová zátěž disku, odesílá dávku **1× za 5 min**.

## Pojmenování / viditelnost

Agent je **viditelný proces** (kvůli transparentnosti dle §316 ZP – ne skrytý).
Název produktu/EXE lze změnit v `WorkView.Agent.csproj` (`AssemblyTitle`,
`Product`, výstupní název) a v MSI. Doporučujeme **srozumitelný název**
(ne maskování za systémový proces), ať je nasazení právně čisté.

## Buffer

Při výpadku sítě se intervaly ukládají do `%ProgramData%\WorkView\spool.ndjson`
a odešlou později (idempotentní ingest na backendu).
