@echo off
REM ============================================================
REM  FOCUS Agent - kompletni odinstalace (dvojklikem).
REM  Sam si zazada o UAC.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  Self-elevation
REM ============================================================
net session >nul 2>&1
if not errorlevel 1 goto :is_admin
echo.
echo ============================================================
echo  Klikni "Ano" na dialog UAC, ktery se za chvili otevre.
echo  Pote se otevre NOVE okno s odinstalaci.
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
if errorlevel 1 (
  echo [CHYBA] Spusteni s UAC selhalo. Mozna jsi kliknul "Ne".
  echo.
  pause
  exit /b 1
)
echo Odinstalace bezi v novem (administratorskem) okne.
echo Toto okno muzes zavrit.
timeout /t 8 /nobreak >nul
exit /b 0

:is_admin
cd /d "%~dp0"
title FOCUS Agent - odinstalace

echo.
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
if exist "%~dp0FocusAgent.msi" (
  msiexec /x "%~dp0FocusAgent.msi" /qn /norestart >nul 2>&1
)
for /f "tokens=2 delims==" %%a in ('wmic product where "Name='MA win 32'" get IdentifyingNumber /value 2^>nul ^| find "="') do (
  msiexec /x %%a /qn /norestart >nul 2>&1
)
echo [OK]
echo.

echo [3/4] Mazu registr HKLM\SOFTWARE\WorkView...
reg delete "HKLM\SOFTWARE\WorkView" /f >nul 2>&1
echo [OK]
echo.

echo [4/4] Mazu zbyle soubory...
taskkill /F /IM "MA win 32.exe" >nul 2>&1
if exist "%ProgramData%\WorkView"  rmdir /S /Q "%ProgramData%\WorkView"  >nul 2>&1
if exist "%ProgramFiles%\WorkView" rmdir /S /Q "%ProgramFiles%\WorkView" >nul 2>&1
echo [OK]
echo.

echo ============================================================
echo  HOTOVO. FOCUS Agent je kompletne odinstalovan.
echo ============================================================
echo  Overeni:
echo    sc query MAWin32
echo    reg query HKLM\SOFTWARE\WorkView
echo.
pause
endlocal
