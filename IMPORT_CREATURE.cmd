@echo off
setlocal
set "REPO_ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%scripts\Import-CreaturePack.ps1" %*
set "IMPORT_EXIT_CODE=%ERRORLEVEL%"
echo.
if not defined DSB_IMPORT_NO_PAUSE pause
exit /b %IMPORT_EXIT_CODE%
