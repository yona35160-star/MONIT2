@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO / MONIT2 - SETUP
echo   2 screens: Ops Center + Ride App
echo  ========================================
echo.

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [OK] Created .env from .env.example - fill NEW Firebase values; VITE_WEBAPP_URL defaults to http://localhost:4000.
  ) else (
    echo [ERROR] .env.example missing.
    pause & exit /b 1
  )
) else (
  echo [OK] .env already exists - left untouched.
)

if not exist "bridge\.env" (
  if exist "bridge\.env.example" (
    copy /Y "bridge\.env.example" "bridge\.env" >nul
    echo [OK] Created bridge\.env from template.
  ) else (
    echo [WARN] bridge\.env.example missing - skip bridge env.
  )
) else (
  echo [OK] bridge\.env already exists - left untouched.
)

if not exist "server\.env" (
  if exist "server\.env.example" (
    copy /Y "server\.env.example" "server\.env" >nul
    echo [OK] Created server\.env from template (local Mongo API).
  )
) else (
  echo [OK] server\.env already exists - left untouched.
)

echo.
echo [1/3] npm install (root)...
call npm install
if errorlevel 1 (
  echo [ERROR] root npm install failed
  pause & exit /b 1
)

echo [2/3] npm install (bridge)...
pushd bridge
call npm install
if errorlevel 1 (
  echo [ERROR] bridge npm install failed
  popd & pause & exit /b 1
)
popd

echo [3/3] npm install (server / Mongo API)...
pushd server
call npm install
if errorlevel 1 (
  echo [ERROR] server npm install failed
  popd & pause & exit /b 1
)
popd

echo.
echo Starting Mongo API + 2 apps (no prompts)...
echo   If API fails, start Mongo first: START-MONGO.bat
start "TAXIPRO Mongo API" cmd /k "cd /d "%~dp0" && npm run dev:api"
timeout /t 2 /nobreak >nul
start "TAXIPRO Ops Center" cmd /k "cd /d "%~dp0" && npm run dev:ops"
timeout /t 2 /nobreak >nul
start "TAXIPRO Ride App" cmd /k "cd /d "%~dp0" && npm run dev:app"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5275/admin.html"
start "" "http://localhost:5273/app.html"

echo.
echo  ----------------------------------------
echo   Mongo API  : http://localhost:4000     (VITE_WEBAPP_URL)
echo   Ops Center : http://localhost:5275/admin.html
echo   Ride App   : http://localhost:5273/app.html
echo   Bridge     : double-click SETUP-BRIDGE.bat when you have a new WhatsApp
echo   MongoDB    : START-MONGO.bat if mongod is not already running
echo  ----------------------------------------
echo   Fill .env with NEW Firebase (+ optional GAS). Local API default is http://localhost:4000
echo   Local admin stub: admin@taxi.co.il / 123456
echo.

echo [OK] SETUP finished - apps are starting in new windows.
exit /b 0

