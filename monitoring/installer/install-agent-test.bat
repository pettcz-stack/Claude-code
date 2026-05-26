@echo off
REM ============================================================
REM  FOCUS Agent - instalace (dvojklikem).
REM  - Sam si zazada o UAC.
REM  - Sam si najde FocusAgent.msi.
REM  - Sam overi, ze server bezi.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  Self-elevation: pokud nejsme admin, znovu pustime sebe s UAC
REM ============================================================
net session >nul 2>&1
if not errorlevel 1 goto :is_admin
echo.
echo ============================================================
echo  Klikni "Ano" na dialog UAC, ktery se za chvili otevre.
echo  Pote se otevre NOVE okno se samotnou instalaci.
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
if errorlevel 1 (
  echo [CHYBA] Spusteni s UAC selhalo. Mozna jsi kliknul "Ne".
  echo.
  pause
  exit /b 1
)
echo Instalace bezi v novem (administratorskem) okne.
echo Toto okno muzes zavrit.
echo.
timeout /t 8 /nobreak >nul
exit /b 0

:is_admin
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

title FOCUS Agent - instalace

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
if exist "%~dp0FocusAgent.msi"                                          set "MSI=%~dp0FocusAgent.msi"
if not defined MSI if exist "%~dp0..\FocusAgent.msi"                    set "MSI=%~dp0..\FocusAgent.msi"
if not defined MSI if exist "%USERPROFILE%\Downloads\FocusAgent.msi"    set "MSI=%USERPROFILE%\Downloads\FocusAgent.msi"
if not defined MSI if exist "%USERPROFILE%\Downloads\focus-installer\FocusAgent.msi"      set "MSI=%USERPROFILE%\Downloads\focus-installer\FocusAgent.msi"
if not defined MSI if exist "%USERPROFILE%\Downloads\focus-windows-build\FocusAgent.msi" set "MSI=%USERPROFILE%\Downloads\focus-windows-build\FocusAgent.msi"
if not defined MSI goto :missing_msi
if not exist "%MSI%" goto :missing_msi
echo [OK] Pouzivam MSI:  %MSI%
echo.

REM ============================================================
REM  KROK 1: Pre-flight - ozve se backend?
REM ============================================================
echo [1/5] Overuji, ze backend bezi na %BACKENDURL% ...
powershell -NoProfile -Command "try { [void](Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 '%BACKENDURL%/api/v1/health'); exit 0 } catch { exit 1 }"
if errorlevel 1 goto :backend_down
echo [OK] Backend odpovida.
goto :step_clean

:backend_down
echo [POZOR] Backend na %BACKENDURL% neodpovida.
echo         Spust nejdriv server (monitoring\start-demo.bat).
echo         Nebo otevri tento .bat v Poznamkovem bloku a uprav BACKENDURL.
echo.
set /p "CONTINUE=Pokracovat presto v instalaci? [a/N]: "
if /i "!CONTINUE!"=="a" goto :step_clean
echo Instalace prerusena.
echo.
pause
exit /b 1

:step_clean
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
  echo [CHYBA] Instalace MSI selhala. Log: %TEMP%\FocusAgent-install.log
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
  echo  - Mrkni: %%ProgramData%%\WorkView\watchdog.log
  echo  - Mrkni: %TEMP%\FocusAgent-install.log
) else (
  echo [OK] Sluzba MAWin32 RUNNING.
)
echo.

echo ============================================================
echo  HOTOVO. FOCUS Agent bezi.
echo ============================================================
echo  V dashboardu (%BACKENDURL%) -^> Sprava -^> Zarizeni
echo  se PC objevi do ~5 minut. Aktivita po ~10 minutach prace.
echo.
echo  Log agenta:  %%ProgramData%%\WorkView\agent.log
echo.
pause
endlocal
exit /b 0

:missing_msi
echo.
echo ============================================================
echo  [CHYBA] FocusAgent.msi se nepodarilo najit.
echo ============================================================
echo Hledal jsem v:
echo   %~dp0
echo   %~dp0..
echo   %USERPROFILE%\Downloads
echo   %USERPROFILE%\Downloads\focus-installer
echo   %USERPROFILE%\Downloads\focus-windows-build
echo.
echo Reseni:
echo   1) Stahni "focus-installer.zip" z GitHub Releases.
echo   2) Rozbal ZIP do jedne slozky.
echo   3) Spust "Instalovat FOCUS agenta.bat" z te slozky.
echo.
pause
exit /b 1
