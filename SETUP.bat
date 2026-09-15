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
    echo [OK] Created .env from .env.example - fill NEW Firebase / GAS / WhatsApp values.
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

echo.
echo [1/2] npm install (root)...
call npm install
if errorlevel 1 (
  echo [ERROR] root npm install failed
  pause & exit /b 1
)

echo [2/2] npm install (bridge)...
pushd bridge
call npm install
if errorlevel 1 (
  echo [ERROR] bridge npm install failed
  popd & pause & exit /b 1
)
popd

echo.
echo Starting 2 apps (no prompts)...
start "TAXIPRO Ops Center" cmd /k "cd /d "%~dp0" && npm run dev:ops"
timeout /t 2 /nobreak >nul
start "TAXIPRO Ride App" cmd /k "cd /d "%~dp0" && npm run dev:app"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5275/admin.html"
start "" "http://localhost:5273/app.html"

echo.
echo  ----------------------------------------
echo   Ops Center : http://localhost:5275/admin.html
echo   Ride App   : http://localhost:5273/app.html
echo   Bridge     : double-click SETUP-BRIDGE.bat when you have a new WhatsApp
echo  ----------------------------------------
echo   Fill .env with NEW Firebase + GAS + WhatsApp before live data.
echo.

echo [OK] SETUP finished - apps are starting in new windows.
exit /b 0

