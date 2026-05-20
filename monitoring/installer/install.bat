@echo off
REM Fallback instalace WorkView Agenta (pokud nelze přes GPO Software Installation).
REM Tichá per-machine instalace s předáním konfigurace serveru.
REM Spouštět s právy administrátora (např. přes GPO startup script / SCCM).

set MSI=%~dp0WorkViewAgent.msi
set BACKENDURL=https://workview.firma.cz
set INGESTTOKEN=ZMEN_ME
set INTERVALSECONDS=60

msiexec /i "%MSI%" /qn /norestart ^
  BACKENDURL=%BACKENDURL% ^
  INGESTTOKEN=%INGESTTOKEN% ^
  INTERVALSECONDS=%INTERVALSECONDS% ^
  /l*v "%TEMP%\WorkViewAgent-install.log"

exit /b %ERRORLEVEL%
