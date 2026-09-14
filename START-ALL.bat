@echo off
chcp 65001 >nul
REM Isolated clone launcher — different ports, no tunnel to original GAS.
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO CLONE - isolated local system
echo  ========================================
echo.

if not exist ".env" (
    echo [ERROR] .env missing.
    pause & exit /b 1
)
if not exist "bridge\.env" (
    echo [ERROR] bridge\.env missing.
    pause & exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing root dependencies...
    call npm install || (echo [ERROR] npm install failed & pause & exit /b 1)
)
if not exist "bridge\node_modules" (
    echo [INFO] Installing bridge dependencies...
    pushd bridge
    call npm install || (echo [ERROR] bridge npm install failed & popd & pause & exit /b 1)
    popd
)

echo [1/4] WhatsApp Bridge (port 3012) — new session, not the original...
start "TAXIPRO-CLONE - WhatsApp Bridge" cmd /k "cd /d "%~dp0bridge" && RUN-BRIDGE.bat"
timeout /t 3 /nobreak >nul

echo [2/4] Passenger  http://localhost:5273
start "TAXIPRO-CLONE - Passenger" cmd /k "cd /d "%~dp0" && npm run dev:passenger"
timeout /t 2 /nobreak >nul

echo [3/4] Driver     http://localhost:5274
start "TAXIPRO-CLONE - Driver" cmd /k "cd /d "%~dp0" && npm run dev:driver"
timeout /t 2 /nobreak >nul

echo [4/4] Admin      http://localhost:5275
start "TAXIPRO-CLONE - Admin" cmd /k "cd /d "%~dp0" && npm run dev:admin"

echo.
timeout /t 6 /nobreak >nul
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="VITE_BRIDGE_API_KEY" set "BRIDGE_KEY=%%B"
)
start "" "http://localhost:3012/qr?role=dispatcher&key=%BRIDGE_KEY%"
start "" "http://localhost:5275/admin.html#/station-order"

echo  Passenger     : http://localhost:5273/passenger.html
echo  Driver        : http://localhost:5274/driver.html
echo  Station form  : http://localhost:5275/admin.html#/station-order
echo  Bridge        : http://localhost:3012/health
echo.
echo  This clone does NOT use the original Firebase / GAS / WhatsApp group.
echo  Create a new Firebase project, new Apps Script, and a new WA group
echo  before going live. See ISOLATED-CLONE.md
echo.
pause >nul
