@echo off
setlocal
if "%~1"=="" (
  echo Drag one exported Encounter JSON file onto IMPORT_ENCOUNTER.cmd.
  pause
  exit /b 1
)
node "%~dp0scripts\install-encounter.mjs" "%~1"
set "DSB_IMPORT_EXIT=%ERRORLEVEL%"
if not "%DSB_IMPORT_EXIT%"=="0" pause
exit /b %DSB_IMPORT_EXIT%
