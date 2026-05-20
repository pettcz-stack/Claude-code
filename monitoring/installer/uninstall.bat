@echo off
REM Tichá odinstalace WorkView Agenta.
msiexec /x "%~dp0WorkViewAgent.msi" /qn /norestart /l*v "%TEMP%\WorkViewAgent-uninstall.log"
exit /b %ERRORLEVEL%
