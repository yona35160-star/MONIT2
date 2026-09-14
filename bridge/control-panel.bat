@echo off
title Taxi Bridge Control Panel (2026 Edition)
color 0B

:: Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org
    pause
    exit
)

:: Auto-install dependencies if missing
if not exist "node_modules" (
    echo [INFO] First time setup detected. Installing dependencies...
    call npm install
)

:menu
cls
echo ====================================================
echo      🚖 TAXI BRIDGE - MANAGEMENT CONSOLE 🚖
echo ====================================================
echo.
echo  1. START BRIDGE (Local Mode)
echo  2. RESET ALL SESSIONS (Force Re-sync / Re-scan)
echo  3. UPDATE SYSTEM (npm install)
echo  4. VIEW RECENT LOGS
echo  5. EXIT
echo.
echo ----------------------------------------------------
echo.
set /p choice=Select an option (1-5): 

if "%choice%"=="1" goto start
if "%choice%"=="2" goto reset
if "%choice%"=="3" goto update
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto exit

:start
cls
echo [INFO] Starting Multi-Bot WhatsApp Bridge...
echo [HINT] Press Ctrl+C to stop the bridge.
echo.
node multi-bot.js
echo.
echo [WARNING] Bridge stopped.
pause
goto menu

:reset
cls
echo [CAUTION] This will delete all local session data.
echo [CAUTION] You will need to scan QR codes for all 3 roles again.
echo.
set /p confirm=Are you sure? (y/n): 
if /i "%confirm%" neq "y" goto menu

echo [INFO] Cleaning session cache...
if exist "sessions" rmdir /s /q "sessions"
if exist "auth_info_baileys" rmdir /s /q "auth_info_baileys"
if exist "auth_dispatcher" rmdir /s /q "auth_dispatcher"
if exist "auth_driver" rmdir /s /q "auth_driver"
if exist "auth_passenger" rmdir /s /q "auth_passenger"

echo [SUCCESS] All session cache cleared.
pause
goto menu

:update
cls
echo [INFO] Updating dependencies via npm...
call npm install
echo [SUCCESS] Update complete.
pause
goto menu

:logs
cls
echo [INFO] Displaying latest entries from logs (if enabled)...
if exist "error.log" (
    powershell -Command "Get-Content error.log -Tail 20"
) else (
    echo [INFO] No log files found.
)
pause
goto menu

:exit
exit
