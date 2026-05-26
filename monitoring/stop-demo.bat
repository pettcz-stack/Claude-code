@echo off
REM Zastavi testovaci FOCUS server. Staci 2x kliknout.
cd /d "%~dp0"
echo Zastavuji FOCUS demo server...
docker compose -f docker-compose.demo.yml down
echo.
echo Hotovo - server je vypnuty.
pause
