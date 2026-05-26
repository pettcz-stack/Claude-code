@echo off
REM Tichá odinstalace FOCUS Agenta.
msiexec /x "%~dp0FocusAgent.msi" /qn /norestart /l*v "%TEMP%\FocusAgent-uninstall.log"
exit /b %ERRORLEVEL%
