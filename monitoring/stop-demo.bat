@echo off
REM Zastavi testovaci WorkView server. Staci 2x kliknout.
cd /d "%~dp0"
echo Zastavuji WorkView demo server...
docker compose -f docker-compose.demo.yml down
echo.
echo Hotovo - server je vypnuty.
pause
