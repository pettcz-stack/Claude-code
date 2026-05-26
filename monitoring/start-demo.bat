@echo off
REM ============================================================
REM  FOCUS - spusteni testovaciho serveru (demo, vse na 1 PC)
REM  Staci 2x kliknout. Vyzaduje spusteny Docker Desktop.
REM ============================================================
cd /d "%~dp0"
echo.
echo Kontroluji Docker Desktop...
docker version >nul 2>&1 || (echo [CHYBA] Docker Desktop nebezi. Spust Docker Desktop, pockej az bude vlevo dole "Engine running", a spust tento soubor znovu. & echo. & pause & exit /b 1)
echo Docker OK.
echo.
echo Spoustim server (prvni spusteni stahuje a sestavuje - muze trvat par minut)...
docker compose -f docker-compose.demo.yml up --build -d || (echo [CHYBA] Server se nepodarilo spustit. Posli tento vypis Claudovi. & echo. & pause & exit /b 1)
echo.
echo Cekam, az server nabehne...
powershell -NoProfile -Command "$u='http://localhost:8080/api/v1/health'; for($i=0;$i -lt 90;$i++){ try{ if((Invoke-WebRequest -UseBasicParsing $u -TimeoutSec 2).StatusCode -eq 200){ exit 0 } }catch{}; Start-Sleep 2 }; exit 1"
if errorlevel 1 (echo [POZOR] Server jeste nenabehl. Zkus za chvili rucne otevrit http://localhost:8080) else (echo Server bezi!)
echo.
echo Otviram dashboard v prohlizeci...
start "" "http://localhost:8080"
echo.
echo ============================================================
echo  HOTOVO.  Dashboard: http://localhost:8080
echo  Prihlaseni:  admin / admin
echo  Server bezi na pozadi. Vypnes ho souborem  stop-demo.bat
echo ============================================================
echo.
pause
