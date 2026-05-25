@echo off
REM Zastavi testovaci Device Monitor server. Staci 2x kliknout.
cd /d "%~dp0"
echo Zastavuji Device Monitor demo server...
docker compose -f docker-compose.demo.yml down
echo.
echo Hotovo - server je vypnuty.
pause
