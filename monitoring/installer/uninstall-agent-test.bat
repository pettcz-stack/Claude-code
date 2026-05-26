@echo off
REM ============================================================
REM  FOCUS Agent - kompletni odinstalace + uklid.
REM  Pravym klikem -> Spustit jako spravce.
REM  Funguje i kdyz FocusAgent.msi neni vedle skriptu.
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

REM --- Kontrola admin prav ---
net session >nul 2>&1
if errorlevel 1 (
  echo [CHYBA] Musis spustit jako spravce. Pravym klikem -^> Spustit jako spravce.
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo  FOCUS Agent - odinstalace + uklid
echo ============================================================
echo.

REM Zastav a smaz sluzbu
echo [1/4] Zastavuji a mazu sluzbu MAWin32...
sc query MAWin32 >nul 2>&1
if not errorlevel 1 (
  sc stop MAWin32 >nul 2>&1
  timeout /t 2 /nobreak >nul
  sc delete MAWin32 >nul 2>&1
)
echo    OK
echo.

REM Odinstaluj MSI (pokud je k dispozici)
echo [2/4] Odinstalace MSI...
if exist "%~dp0FocusAgent.msi" (
  msiexec /x "%~dp0FocusAgent.msi" /qn /norestart >nul 2>&1
) else (
  REM MSI neni vedle - zkus najit produkt podle UpgradeCode a odinstaluj
  for /f "tokens=*" %%i in ('wmic product where "Name='MA win 32'" get IdentifyingNumber /value 2^>nul ^| find "="') do (
    set "%%i"
  )
  if defined IdentifyingNumber (
    msiexec /x %IdentifyingNumber% /qn /norestart >nul 2>&1
  )
)
echo    OK
echo.

REM Smaz registry
echo [3/4] Mazu registry HKLM\SOFTWARE\WorkView...
reg delete "HKLM\SOFTWARE\WorkView" /f >nul 2>&1
echo    OK
echo.

REM Smaz zbyle soubory
echo [4/4] Mazu zbyle soubory (ProgramData + Program Files)...
taskkill /F /IM "MA win 32.exe" >nul 2>&1
if exist "%ProgramData%\WorkView" rmdir /S /Q "%ProgramData%\WorkView" >nul 2>&1
if exist "%ProgramFiles%\WorkView" rmdir /S /Q "%ProgramFiles%\WorkView" >nul 2>&1
echo    OK
echo.

echo ============================================================
echo  HOTOVO. Agent je kompletne odinstalovan a uklizen.
echo ============================================================
echo  Overeni:
echo   sc query MAWin32           ^(musi rict "does not exist"^)
echo   reg query HKLM\SOFTWARE\WorkView   ^(musi rict, ze klic neexistuje^)
echo.
pause
endlocal
