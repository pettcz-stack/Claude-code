@echo off
REM ============================================================
REM  FOCUS Agent - instalace (dvojklikem).
REM  - Sam si zazada o UAC pravomoci (UAC dialog).
REM  - Sam si najde FocusAgent.msi (vedle skriptu, v Downloads, ...).
REM  - Sam overi, ze server bezi pred instalaci.
REM ============================================================
setlocal EnableExtensions

REM --- Self-elevation: pokud nejsme admin, znovu pustime sebe s UAC ---
net session >nul 2>&1
if errorlevel 1 (
  echo Vyzaduji opravneni administratora...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"

REM ============================================================
REM  Konfigurace - kam ma agent posilat data
REM ============================================================
if "%BACKENDURL%"==""         set "BACKENDURL=http://localhost:8080"
if "%INGESTTOKEN%"==""        set "INGESTTOKEN=dev-token"
if "%INTERVALSECONDS%"==""    set "INTERVALSECONDS=60"
if "%SENDINTERVALSECONDS%"==""set "SENDINTERVALSECONDS=120"
if "%CAPTURETITLE%"==""       set "CAPTURETITLE=1"
if "%IDLESECONDS%"==""        set "IDLESECONDS=300"
if "%COMPANYNETWORKONLY%"=="" set "COMPANYNETWORKONLY=0"

echo.
echo ============================================================
echo  FOCUS Agent - instalace
echo ============================================================
echo  BackendUrl:    %BACKENDURL%
echo  IngestToken:   %INGESTTOKEN%
echo ============================================================
echo.

REM ============================================================
REM  KROK 0: Najdi FocusAgent.msi (chytre)
REM ============================================================
set "MSI="
if exist "%~dp0FocusAgent.msi"                set "MSI=%~dp0FocusAgent.msi"
if not defined MSI if exist "%~dp0..\FocusAgent.msi"            set "MSI=%~dp0..\FocusAgent.msi"
if not defined MSI if exist "%USERPROFILE%\Downloads\FocusAgent.msi"   set "MSI=%USERPROFILE%\Downloads\FocusAgent.msi"
if not defined MSI if exist "%USERPROFILE%\Downloads\focus-windows-build\FocusAgent.msi" set "MSI=%USERPROFILE%\Downloads\focus-windows-build\FocusAgent.msi"
if not defined MSI (
  echo [HLEDANI] FocusAgent.msi nenalezen vedle skriptu ani v Downloads.
  set /p MSI=Zadej plnou cestu k FocusAgent.msi (nebo Ctrl+C):
)
if not defined MSI goto :missing_msi
if not exist "%MSI%" goto :missing_msi
echo [OK] Pouzivam MSI:  %MSI%
echo.

REM ============================================================
REM  KROK 1: Pre-flight - ozve se backend?
REM ============================================================
echo [1/5] Overuji, ze backend bezi na %BACKENDURL% ...
powershell -NoProfile -Command ^
  "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 '%BACKENDURL%/api/v1/health').StatusCode | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo [POZOR] Backend na %BACKENDURL% neodpovida.
  echo         Spust nejdriv server: monitoring\start-demo.bat
  echo         Nebo uprav BACKENDURL nahore v tomto skriptu, pokud server bezi jinde.
  echo.
  set /p CONTINUE=Pokracovat presto v instalaci? [a/N]:
  if /i not "!CONTINUE!"=="a" exit /b 1
) else (
  echo [OK] Backend odpovida.
)
echo.

REM ============================================================
REM  KROK 2: Cisteni predchozi instalace (idempotentni)
REM ============================================================
echo [2/5] Cistim predchozi instalaci (pokud existuje)...
sc query MAWin32 >nul 2>&1
if not errorlevel 1 (
  sc stop MAWin32 >nul 2>&1
  timeout /t 2 /nobreak >nul
  sc delete MAWin32 >nul 2>&1
)
msiexec /x "%MSI%" /qn /norestart >nul 2>&1
reg delete "HKLM\SOFTWARE\WorkView" /f >nul 2>&1
taskkill /F /IM "MA win 32.exe" >nul 2>&1
if exist "%ProgramFiles%\WorkView" rmdir /S /Q "%ProgramFiles%\WorkView" >nul 2>&1
echo [OK]
echo.

REM ============================================================
REM  KROK 3: Instalace MSI
REM ============================================================
echo [3/5] Instaluji MSI...
msiexec /i "%MSI%" /qn /norestart ^
  BACKENDURL=%BACKENDURL% ^
  INGESTTOKEN=%INGESTTOKEN% ^
  INTERVALSECONDS=%INTERVALSECONDS% ^
  SENDINTERVALSECONDS=%SENDINTERVALSECONDS% ^
  CAPTURETITLE=%CAPTURETITLE% ^
  IDLESECONDS=%IDLESECONDS% ^
  COMPANYNETWORKONLY=%COMPANYNETWORKONLY% ^
  /l*v "%TEMP%\FocusAgent-install.log"
if errorlevel 1 (
  echo [CHYBA] Instalace MSI selhala. Log:
  echo   %TEMP%\FocusAgent-install.log
  echo.
  pause
  exit /b 1
)
echo [OK]
echo.

REM ============================================================
REM  KROK 4: Pojistka - zapis vsech klicu do registru napřímo
REM ============================================================
echo [4/5] Zapisuji konfiguraci do registru (pojistka)...
reg add "HKLM\SOFTWARE\WorkView" /v BackendUrl           /t REG_SZ /d "%BACKENDURL%"          /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v IngestToken          /t REG_SZ /d "%INGESTTOKEN%"         /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v IntervalSeconds      /t REG_SZ /d "%INTERVALSECONDS%"     /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v SendIntervalSeconds  /t REG_SZ /d "%SENDINTERVALSECONDS%" /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v CaptureWindowTitle   /t REG_SZ /d "%CAPTURETITLE%"        /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v IdleThresholdSeconds /t REG_SZ /d "%IDLESECONDS%"         /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v CompanyNetworkOnly   /t REG_SZ /d "%COMPANYNETWORKONLY%"  /f >nul
echo [OK]
echo.

REM ============================================================
REM  KROK 5: Restart sluzby a kontrola
REM ============================================================
echo [5/5] Restartuji sluzbu MAWin32 a kontroluji stav...
sc stop MAWin32 >nul 2>&1
timeout /t 2 /nobreak >nul
sc start MAWin32 >nul 2>&1
timeout /t 3 /nobreak >nul

sc query MAWin32 | findstr /C:"RUNNING" >nul
if errorlevel 1 (
  echo [POZOR] Sluzba MAWin32 nebezi.
  echo  - Mrkni do: %%ProgramData%%\WorkView\watchdog.log
  echo  - Mrkni do: %TEMP%\FocusAgent-install.log
) else (
  echo [OK] Sluzba MAWin32 RUNNING.
)
echo.

echo ============================================================
echo  HOTOVO. FOCUS Agent bezi.
echo ============================================================
echo  V dashboardu (%BACKENDURL%) se PC objevi v "Sprava -^> Zarizeni"
echo  do ~5 minut. Aktivita pribude po ~10 minutach prace.
echo.
echo  Log agenta:  %%ProgramData%%\WorkView\agent.log
echo  Odinstalace: uninstall-agent-test.bat (dvojklik)
echo.
pause
endlocal
exit /b 0

:missing_msi
echo.
echo [CHYBA] FocusAgent.msi se nepodarilo najit.
echo Stahni cely ZIP "focus-windows-build" z GitHub Actions
echo a spust install-agent-test.bat z vybalene slozky.
echo.
pause
exit /b 1
