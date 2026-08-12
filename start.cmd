@echo off
setlocal
title WD World Launcher
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo WD World failed to start. See start.log for details.
    echo.
    pause
)

exit /b %EXIT_CODE%
