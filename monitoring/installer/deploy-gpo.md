# Nasazení WorkView Agenta přes Active Directory (GPO)

Cíl: tichá vzdálená instalace `.msi` na firemní Windows PC přes Group Policy.

## Předpoklady

- Doménový řadič s GPMC.
- Sdílená složka (UNC) čitelná pro účty počítačů, kde leží `WorkViewAgent.msi`
  (např. `\\dc01\Software$\WorkView\WorkViewAgent.msi`).
- Sestavený MSI (viz `README.md`).

## Varianta A – GPO Software Installation (doporučeno)

1. **Sdílení MSI**
   - Nakopíruj `WorkViewAgent.msi` do UNC sdílení.
   - Oprávnění: skupina `Domain Computers` = Read.

2. **Konfigurace serveru přes MST transform** (aby se `INGESTTOKEN`/`BACKENDURL`
   nezadávaly ručně). Vytvoř transform `config.mst`, který nastaví property:
   - `BACKENDURL = https://workview.firma.cz`
   - `INGESTTOKEN = <token>`
   - `INTERVALSECONDS = 60`

   Transform lze vyrobit nástrojem Orca (Microsoft) nebo `dark`/`torch` (WiX):
   uprav tabulku `Property` a ulož jako `.mst` vedle MSI na sdílení.

3. **Vytvoř GPO**
   - GPMC → nové GPO, např. „WorkView Agent – Deploy", linkni na OU s cílovými PC.

4. **Přidej balíček**
   - Edit GPO → `Computer Configuration` → `Policies` → `Software Settings`
     → `Software installation` → pravým → `New` → `Package`.
   - **Vyber MSI přes UNC cestu** (`\\dc01\Software$\WorkView\WorkViewAgent.msi`),
     ne přes lokální disk – jinak instalace selže.
   - Deployment method: **Assigned** (tichá instalace bez interakce uživatele).
   - Na záložce **Modifications** přidej `config.mst` (krok 2).

5. **Spolehlivost startu**
   - `Computer Configuration` → `Administrative Templates` → `System` → `Logon`
     → **„Always wait for the network at computer startup and logon" = Enabled**
     (jinak může PC dosáhnout plochy dřív, než je dostupné UNC sdílení).

6. **Aplikace**
   - GPO Software Installation se aplikuje **při startu počítače** (ne jen
     `gpupdate`). Restartuj cílová PC.

7. **Ověření**
   - Na klientu: klíč `HKLM\SOFTWARE\WorkView` obsahuje `BackendUrl/IngestToken`.
   - Agent startuje při příštím přihlášení uživatele (ikona v oznamovací oblasti).
   - V dashboardu se po pár intervalech objeví zařízení a data.

## Upgrade / odinstalace

- **Upgrade:** sestav nový MSI s vyšší `Version` (zachovej `UpgradeCode`),
  nahraď soubor na sdílení a v GPO přidej nový balíček s volbou „Upgrade".
  `MajorUpgrade` ve WiX zajistí odebrání staré verze.
- **Odinstalace:** v GPO Software installation → balíček → `All tasks` →
  `Remove` → „Immediately uninstall".

## Varianta B – GPO Startup Script (fallback `.bat`)

Pokud nelze použít Software Installation:
- `Computer Configuration` → `Policies` → `Windows Settings` → `Scripts (Startup)`.
- Přidej `install.bat` (uprav v něm `INGESTTOKEN`/`BACKENDURL`).
- Skript běží jako `LocalSystem` při startu → tichá `msiexec /i ... /qn`.

> Varianta A je preferovaná: zvládá upgrade, repair i odinstalaci a má rollback.
