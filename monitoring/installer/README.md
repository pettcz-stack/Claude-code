# WorkView Agent – instalátor (MSI / WiX)

MSI balíček pro vzdálené nasazení agenta přes Active Directory (GPO).

## Co MSI udělá

- Nainstaluje `WorkView.Agent.exe` do `C:\Program Files\WorkView\`.
- Zapíše konfiguraci do `HKLM\SOFTWARE\WorkView` (`BackendUrl`, `IngestToken`, `IntervalSeconds`).
- Nastaví autostart agenta v session uživatele přes
  `HKLM\…\CurrentVersion\Run\WorkViewAgent` (spustí se při přihlášení).
- Per-machine, tichá instalace, podpora major upgrade i odinstalace.

## Build (na Windows)

1. Sestav agenta:
   ```powershell
   cd ..\agent\WorkView.Agent
   dotnet build -c Release
   ```
2. Nainstaluj WiX (jednorázově) a postav MSI:
   ```powershell
   dotnet tool install --global wix
   cd ..\..\installer
   ./build.ps1 -AgentExePath ..\agent\WorkView.Agent\bin\Release\net48\WorkView.Agent.exe
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
