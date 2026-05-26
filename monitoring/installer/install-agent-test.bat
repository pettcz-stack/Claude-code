@echo off
REM ============================================================
REM  FOCUS Agent - instalace pro TEST na jednom PC.
REM  Pravym klikem -> Spustit jako spravce (NE 2x klik).
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM --- Kontrola admin prav ---
net session >nul 2>&1
if errorlevel 1 (
  echo [CHYBA] Musis spustit jako spravce. Pravym klikem -^> Spustit jako spravce.
  echo.
  pause
  exit /b 1
)

REM --- Kontrola, ze MSI je vedle skriptu ---
set "MSI=%~dp0FocusAgent.msi"
if not exist "%MSI%" (
  echo [CHYBA] V teto slozce neni FocusAgent.msi.
  echo Zkopiruj sem stazeny instalator z GitHub Actions a spust znovu.
  echo.
  pause
  exit /b 1
)

REM --- Konfigurace (lze pretypovat predanim parametru pri spousteni) ---
if "%BACKENDURL%"=="" set "BACKENDURL=http://localhost:8080"
if "%INGESTTOKEN%"=="" set "INGESTTOKEN=dev-token"
if "%INTERVALSECONDS%"=="" set "INTERVALSECONDS=60"
if "%SENDINTERVALSECONDS%"=="" set "SENDINTERVALSECONDS=120"
if "%CAPTURETITLE%"=="" set "CAPTURETITLE=1"
if "%IDLESECONDS%"=="" set "IDLESECONDS=300"
if "%COMPANYNETWORKONLY%"=="" set "COMPANYNETWORKONLY=0"

echo ============================================================
echo  FOCUS Agent - instalace
echo ============================================================
echo  BackendUrl:      %BACKENDURL%
echo  IngestToken:     %INGESTTOKEN%
echo  Interval:        %INTERVALSECONDS% s
echo  SendInterval:    %SENDINTERVALSECONDS% s
echo  CaptureTitle:    %CAPTURETITLE%
echo ============================================================
echo.

REM ============================================================
REM  KROK 1: Uklid pred instalaci (cisty stav, idempotentni)
REM ============================================================
echo [1/4] Cisteni predchozi instalace (pokud existuje)...

REM Zastav a smaz sluzbu (pokud existuje)
sc query MAWin32 >nul 2>&1
if not errorlevel 1 (
  echo    - zastavuji sluzbu MAWin32
  sc stop MAWin32 >nul 2>&1
  timeout /t 2 /nobreak >nul
  echo    - mazu sluzbu MAWin32
  sc delete MAWin32 >nul 2>&1
)

REM Odinstaluj predchozi MSI (potichu, pokud byl)
msiexec /x "%MSI%" /qn /norestart >nul 2>&1

REM Smaz registry vetev, aby MSI musel vse napsat znovu
reg delete "HKLM\SOFTWARE\WorkView" /f >nul 2>&1

REM Smaz procesni pozustatky agenta v aktualni session
taskkill /F /IM "MA win 32.exe" >nul 2>&1

REM Smaz instalacni slozku, pokud zbyla
if exist "%ProgramFiles%\WorkView" rmdir /S /Q "%ProgramFiles%\WorkView" >nul 2>&1

echo    OK
echo.

REM ============================================================
REM  KROK 2: Instalace noveho MSI
REM ============================================================
echo [2/4] Instalace noveho MSI...
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
  echo [CHYBA] Instalace MSI selhala. Posli soubor:
  echo   %TEMP%\FocusAgent-install.log
  echo.
  pause
  exit /b 1
)
echo    OK
echo.

REM ============================================================
REM  KROK 3: Pojistka - zapis vsech klicu do registru napřímo
REM           (pro pripad, ze MSI nektery vynechal nebo prepsal)
REM ============================================================
echo [3/4] Overeni a doplneni konfigurace v registru...
reg add "HKLM\SOFTWARE\WorkView" /v BackendUrl           /t REG_SZ /d "%BACKENDURL%"          /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v IngestToken          /t REG_SZ /d "%INGESTTOKEN%"         /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v IntervalSeconds      /t REG_SZ /d "%INTERVALSECONDS%"     /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v SendIntervalSeconds  /t REG_SZ /d "%SENDINTERVALSECONDS%" /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v CaptureWindowTitle   /t REG_SZ /d "%CAPTURETITLE%"        /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v IdleThresholdSeconds /t REG_SZ /d "%IDLESECONDS%"         /f >nul
reg add "HKLM\SOFTWARE\WorkView" /v CompanyNetworkOnly   /t REG_SZ /d "%COMPANYNETWORKONLY%"  /f >nul
echo    OK
echo.

REM ============================================================
REM  KROK 4: Restart sluzby (aby si nactla cerstvy registr) + sanity check
REM ============================================================
echo [4/4] Spousteni sluzby a kontrola...
sc stop MAWin32 >nul 2>&1
timeout /t 2 /nobreak >nul
sc start MAWin32 >nul 2>&1
timeout /t 3 /nobreak >nul

sc query MAWin32 | findstr /C:"RUNNING" >nul
if errorlevel 1 (
  echo [POZOR] Sluzba MAWin32 nebezi. Mrkni do %%ProgramData%%\WorkView\watchdog.log
  echo a do %TEMP%\FocusAgent-install.log
) else (
  echo    Sluzba MAWin32 RUNNING.
)

echo.
echo ============================================================
echo  HOTOVO. Agent je nainstalovan a sluzba MAWin32 bezi.
echo ============================================================
echo  Co overit:
echo   - V dashboardu (Sprava -^> Zarizeni) se PC objevi do ~2-5 minut.
echo   - Aktivita do dashboardu dorazi po ~10 minutach prace na PC.
echo   - Log agenta:  %%ProgramData%%\WorkView\agent.log
echo.
pause
endlocal
