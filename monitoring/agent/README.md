# WorkView Agent (Windows)

Lehký agent sbírající **agregované** metriky pracovní aktivity a odesílající je
na backend. Běží v interaktivní session přihlášeného uživatele.

## Co sbírá (a co NE)

Sbírá jen: aktivní/nečinný čas, název aktivní aplikace (proces, **bez titulku okna**),
**počet** úhozů a **počet** myších událostí za interval, příznak uzamčení session.

**Nesbírá:** obsah kláves (žádný keylogging), souřadnice myši, titulky oken,
screenshoty, mikrofon, kameru. Soulad s §316 ZP a GDPR (viz `../../docs/monitoring/NAVRH.md`).

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

Výstup: `bin/Release/net48/WorkView.Agent.exe`.

## Lokální test proti dev backendu

```powershell
$env:WORKVIEW_BACKEND_URL = "http://localhost:4000"
$env:WORKVIEW_INGEST_TOKEN = "dev-token"
$env:WORKVIEW_INTERVAL_SECONDS = "10"
.\bin\Release\net48\WorkView.Agent.exe
```

Data se objeví v dashboardu po několika intervalech.

## Nasazení

Agent se spouští přes Scheduled Task při přihlášení uživatele; instalaci a
konfiguraci řeší MSI instalátor a GPO – viz Blok 1.5 (`../installer`).

## Buffer

Při výpadku sítě se intervaly ukládají do `%ProgramData%\WorkView\spool.ndjson`
a odešlou později (idempotentní ingest na backendu).
