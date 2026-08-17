@echo off
setlocal
if "%~1"=="" (
  echo Drag one or more weapon GLB files onto IMPORT_WEAPON.cmd.
  pause
  exit /b 1
)
node "%~dp0scripts\import-weapon.mjs" %*
set "DSB_WEAPON_EXIT=%ERRORLEVEL%"
if not "%DSB_WEAPON_EXIT%"=="0" pause
exit /b %DSB_WEAPON_EXIT%
