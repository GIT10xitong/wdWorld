@echo off
setlocal
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "release\v1.7.0\WDWorld-Desktop-1.7.0\WD World.exe" (
    start "" "release\v1.7.0\WDWorld-Desktop-1.7.0\WD World.exe"
    exit /b 0
)
call npm.cmd run desktop
if errorlevel 1 pause
