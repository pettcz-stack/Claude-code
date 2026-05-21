@echo off
REM Fallback instalace WorkView Agenta (pokud nelze přes GPO Software Installation).
REM Tichá per-machine instalace s předáním konfigurace serveru.
REM Spouštět s právy administrátora (např. přes GPO startup script / SCCM).

set MSI=%~dp0WorkViewAgent.msi
set BACKENDURL=https://workview.firma.cz
set INGESTTOKEN=ZMEN_ME
REM Délka jednoho měřeného intervalu (s). Výchozí 60 = jeden záznam za minutu.
set INTERVALSECONDS=60
REM Jak často se dávka odešle na server (s). Výchozí 900 = jednou za 15 minut.
set SENDINTERVALSECONDS=900
REM Po kolika sekundách bez vstupu se interval počítá jako nečinnost. Výchozí 300 = 5 min.
set IDLESECONDS=300
REM 1 = ukládat i titulek aktivního okna, 0 = jen název procesu (méně osobních dat).
set CAPTURETITLE=0
REM 1 = odesílat jen z firemní sítě (LAN/VPN s firemním DNS); jinak data zůstanou v bufferu.
set COMPANYNETWORKONLY=0
REM Interní-only hostname pro ověření firemní sítě (musí se VENKU nepřeložit). Nech prázdné při COMPANYNETWORKONLY=0.
set COMPANYPROBEHOST=

msiexec /i "%MSI%" /qn /norestart ^
  BACKENDURL=%BACKENDURL% ^
  INGESTTOKEN=%INGESTTOKEN% ^
  INTERVALSECONDS=%INTERVALSECONDS% ^
  SENDINTERVALSECONDS=%SENDINTERVALSECONDS% ^
  IDLESECONDS=%IDLESECONDS% ^
  CAPTURETITLE=%CAPTURETITLE% ^
  COMPANYNETWORKONLY=%COMPANYNETWORKONLY% ^
  COMPANYPROBEHOST=%COMPANYPROBEHOST% ^
  /l*v "%TEMP%\WorkViewAgent-install.log"

exit /b %ERRORLEVEL%
