@echo off
REM Tichá odinstalace Device Monitor Agenta.
msiexec /x "%~dp0DeviceMonitorAgent.msi" /qn /norestart /l*v "%TEMP%\DeviceMonitorAgent-uninstall.log"
exit /b %ERRORLEVEL%
