@echo off
title Medinex Launcher
color 0b

echo ===================================================
echo               Launching Medinex...
echo ===================================================
echo.

if exist "%~dp0package.json" (
    cd /d "%~dp0"
) else if exist "%~dp0medinex\package.json" (
    cd /d "%~dp0medinex"
) else (
    cd /d "D:\Medinex\medinex"
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies and setting up database...
    call npm run setup
)

echo [OK] Starting Medinex API and Web App...
echo [OK] Opening in your browser: http://localhost:5173
echo.
echo Keep this window open while using Medinex.
echo To shut down, simply close this window or press Ctrl+C.
echo ===================================================
echo.

start /min "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5173"

npm run dev

pause
