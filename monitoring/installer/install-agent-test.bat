@echo off
REM ============================================================
REM  FOCUS - instalace agenta pro TEST na jednom PC.
REM  Miri na testovaci server http://localhost:8080 (token dev-token).
REM  Polozte tento soubor do slozky, kde mate stazene FocusAgent.msi,
REM  a 2x kliknete. Sam si rekne o opravneni administratora (okno UAC).
REM ============================================================
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0"
if not exist "%~dp0FocusAgent.msi" (echo [CHYBA] V teto slozce neni FocusAgent.msi. Zkopiruj sem stazeny instalator a spust znovu. & echo. & pause & exit /b 1)
echo Instaluji agenta (miri na testovaci server http://localhost:8080)...
msiexec /i "%~dp0FocusAgent.msi" /qn /norestart BACKENDURL=http://localhost:8080 INGESTTOKEN=dev-token INTERVALSECONDS=60 SENDINTERVALSECONDS=120 CAPTURETITLE=1 COMPANYNETWORKONLY=0 /l*v "%TEMP%\FocusAgent-install.log"
if errorlevel 1 (echo [CHYBA] Instalace selhala. Posli soubor %TEMP%\FocusAgent-install.log Claudovi. & echo. & pause & exit /b 1)
echo.
echo ============================================================
echo  HOTOVO. Agent je nainstalovany a posila data na localhost:8080.
echo  Po par minutach prace se objevis v dashboardu.
echo  (Odinstalace: uninstall-agent-test.bat)
echo ============================================================
echo.
pause
