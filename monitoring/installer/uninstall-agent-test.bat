@echo off
REM Odinstaluje testovaciho agenta. Sam si rekne o opravneni administratora.
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0"
if not exist "%~dp0WorkViewAgent.msi" (echo [CHYBA] V teto slozce neni WorkViewAgent.msi. & pause & exit /b 1)
echo Odinstaluji agenta...
msiexec /x "%~dp0WorkViewAgent.msi" /qn
echo.
echo Hotovo.
pause
