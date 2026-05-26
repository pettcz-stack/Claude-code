@echo off
REM ============================================================
REM  FOCUS Agent - kompletni odinstalace (dvojklikem).
REM  Sam si zazada o UAC. Funguje i bez FocusAgent.msi vedle.
REM ============================================================
setlocal EnableExtensions

REM --- Self-elevation ---
net session >nul 2>&1
if errorlevel 1 (
  echo Vyzaduji opravneni administratora...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"

echo ============================================================
echo  FOCUS Agent - odinstalace + uklid
echo ============================================================
echo.

echo [1/4] Zastavuji a mazu sluzbu MAWin32...
sc query MAWin32 >nul 2>&1
if not errorlevel 1 (
  sc stop MAWin32 >nul 2>&1
  timeout /t 2 /nobreak >nul
  sc delete MAWin32 >nul 2>&1
)
echo [OK]
echo.

echo [2/4] Odinstalace MSI (zkusim oba zpusoby)...
REM 1) Pokud je FocusAgent.msi vedle, pouzij ho
if exist "%~dp0FocusAgent.msi" (
  msiexec /x "%~dp0FocusAgent.msi" /qn /norestart >nul 2>&1
)
REM 2) Plus odinstaluj produkt podle nazvu (i kdyz MSI vedle neni)
for /f "tokens=2 delims==" %%a in ('wmic product where "Name='MA win 32'" get IdentifyingNumber /value 2^>nul ^| find "="') do (
  msiexec /x %%a /qn /norestart >nul 2>&1
)
echo [OK]
echo.

echo [3/4] Mazu registr HKLM\SOFTWARE\WorkView...
reg delete "HKLM\SOFTWARE\WorkView" /f >nul 2>&1
echo [OK]
echo.

echo [4/4] Mazu zbyle soubory (ProgramData + Program Files)...
taskkill /F /IM "MA win 32.exe" >nul 2>&1
if exist "%ProgramData%\WorkView"    rmdir /S /Q "%ProgramData%\WorkView"    >nul 2>&1
if exist "%ProgramFiles%\WorkView"   rmdir /S /Q "%ProgramFiles%\WorkView"   >nul 2>&1
echo [OK]
echo.

echo ============================================================
echo  HOTOVO. FOCUS Agent je kompletne odinstalovan.
echo ============================================================
echo.
echo  Overeni:
echo    sc query MAWin32                  ^(musi rict "does not exist"^)
echo    reg query HKLM\SOFTWARE\WorkView  ^(musi rict, ze klic neexistuje^)
echo.
pause
endlocal
