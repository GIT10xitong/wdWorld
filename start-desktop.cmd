@echo off
setlocal
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "src\main.tsx" if exist "node_modules\electron\dist\electron.exe" goto source
if exist "release\v1.10.1\WDWorld-Desktop-1.10.1\WD World.exe" (
    start "" "release\v1.10.1\WDWorld-Desktop-1.10.1\WD World.exe"
    exit /b 0
)
:source
call npm.cmd run desktop
if errorlevel 1 pause
