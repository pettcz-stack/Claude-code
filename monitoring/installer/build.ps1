# Sestaví MSI z WiX zdroje. Spouštět na Windows s nainstalovaným WiX 4/5.
#
# Instalace WiX (jednorázově):
#   dotnet tool install --global wix
#
# Použití:
#   ./build.ps1 -AgentExePath ..\agent\WorkView.Agent\bin\Release\net48\"MA win 32.exe"

param(
  [Parameter(Mandatory = $true)]
  [string]$AgentExePath,
  [string]$Output = "WorkViewAgent.msi"
)

if (-not (Test-Path $AgentExePath)) {
  Write-Error "Nenalezen agent EXE: $AgentExePath (nejdřív sestav agenta: dotnet build -c Release)"
  exit 1
}

wix build Product.wxs -d "AgentExePath=$AgentExePath" -o $Output
Write-Host "Hotovo: $Output"
