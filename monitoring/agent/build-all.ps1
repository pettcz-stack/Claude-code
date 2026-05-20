# Sestaví agenta + watchdog službu + MSI instalátor.
# Spouštět na Windows. Vyžaduje .NET SDK (8+). WiX se doinstaluje automaticky.
#
#   pwsh ./build-all.ps1
#
# Výstup: monitoring/installer/WorkViewAgent.msi

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host '==> Build agenta'
dotnet build "$root/WorkView.Agent/WorkView.Agent.csproj" -c Release

Write-Host '==> Build watchdog služby'
dotnet build "$root/WorkView.Watchdog/WorkView.Watchdog.csproj" -c Release

Write-Host '==> WiX toolset'
dotnet tool install --global wix --version 5.0.2 2>$null | Out-Null
wix extension add -g WixToolset.Util.wixext/5.0.2 2>$null | Out-Null

Write-Host '==> Build MSI'
Push-Location "$root/../installer"
wix build Product.wxs -ext WixToolset.Util.wixext `
  -d "AgentExePath=..\agent\WorkView.Agent\bin\Release\net48\MA win 32.exe" `
  -d "WatchdogExePath=..\agent\WorkView.Watchdog\bin\Release\net48\MA win 32 Service.exe" `
  -o WorkViewAgent.msi
Pop-Location

Write-Host ''
Write-Host 'Hotovo: monitoring/installer/WorkViewAgent.msi'
