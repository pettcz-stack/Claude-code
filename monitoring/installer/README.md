# WorkView Agent – instalátor (MSI / WiX)

MSI balíček pro vzdálené nasazení agenta přes Active Directory (GPO).

## Co MSI udělá

- Nainstaluje agenta `MA win 32.exe` a hlídací službu `MA win 32 Service.exe`
  do `C:\Program Files\WorkView\`.
- Zaregistruje **službu `MAWin32`** (LocalSystem, auto-start) s **automatickým
  restartem při selhání**. Služba spouští agenta do session přihlášeného uživatele
  a po jeho ukončení ho znovu nahodí (odolnost proti vypnutí).
- Zapíše konfiguraci do `HKLM\SOFTWARE\WorkView`.
- Per-machine, tichá instalace, podpora major upgrade i odinstalace.

> Autostart už neřeší `Run` klíč, ale služba – běžný uživatel bez admin práv ji
> nezastaví ani nezakáže.

## Build (na Windows)

1. Sestav agenta i službu:
   ```powershell
   cd ..\agent\WorkView.Agent && dotnet build -c Release
   cd ..\WorkView.Watchdog && dotnet build -c Release
   ```
2. Nainstaluj WiX + Util rozšíření (jednorázově) a postav MSI:
   ```powershell
   dotnet tool install --global wix
   wix extension add -g WixToolset.Util.wixext
   cd ..\..\installer
   ./build.ps1 `
     -AgentExePath    "..\agent\WorkView.Agent\bin\Release\net48\MA win 32.exe" `
     -WatchdogExePath "..\agent\WorkView.Watchdog\bin\Release\net48\MA win 32 Service.exe"
   ```
   Výstup: `WorkViewAgent.msi`.

## Konfigurace serveru

Property lze nastavit:
- na CLI: `msiexec /i WorkViewAgent.msi /qn BACKENDURL=https://… INGESTTOKEN=… INTERVALSECONDS=60`
- nebo MST transformem pro GPO (viz `deploy-gpo.md`).

## Nasazení přes AD

Krok za krokem v [`deploy-gpo.md`](./deploy-gpo.md). Fallback skripty:
[`install.bat`](./install.bat) / [`uninstall.bat`](./uninstall.bat).

## Bezpečnost

`IngestToken` je citlivý. Při GPO ho vkládej přes MST (ne do veřejných skriptů)
a omez čtení sdílení MSI na účty počítačů. Per-device tokeny a centrální správa
přijdou v Bloku 1.7.
