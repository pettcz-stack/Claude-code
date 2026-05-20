# Sestaví MSI z WiX zdroje. Spouštět na Windows s nainstalovaným WiX 4/5.
#
# Jednorázově:
#   dotnet tool install --global wix
#   wix extension add -g WixToolset.Util.wixext
#
# Použití:
#   ./build.ps1 `
#     -AgentExePath    "..\agent\WorkView.Agent\bin\Release\net48\MA win 32.exe" `
#     -WatchdogExePath "..\agent\WorkView.Watchdog\bin\Release\net48\MA win 32 Service.exe"

param(
  [Parameter(Mandatory = $true)] [string]$AgentExePath,
  [Parameter(Mandatory = $true)] [string]$WatchdogExePath,
  [string]$Output = "WorkViewAgent.msi"
)

if (-not (Test-Path $AgentExePath)) { Write-Error "Nenalezen agent EXE: $AgentExePath"; exit 1 }
if (-not (Test-Path $WatchdogExePath)) { Write-Error "Nenalezen watchdog EXE: $WatchdogExePath"; exit 1 }

wix build Product.wxs -ext WixToolset.Util.wixext `
  -d "AgentExePath=$AgentExePath" `
  -d "WatchdogExePath=$WatchdogExePath" `
  -o $Output

Write-Host "Hotovo: $Output"
