@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO / MONIT2 ? SETUP (Wave Unify)
echo   2 screens: Ops Center + Ride App
echo  ========================================
echo.

REM --- env templates (never commit real .env) ---
if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [OK] Created .env from .env.example ? fill NEW Firebase / GAS / WhatsApp values.
  ) else (
    echo [ERROR] .env.example missing.
    pause & exit /b 1
  )
) else (
  echo [OK] .env already exists ? left untouched.
)

if not exist "bridge\.env" (
  if exist "bridge\.env.example" (
    copy /Y "bridge\.env.example" "bridge\.env" >nul
    echo [OK] Created bridge\.env from template.
  ) else (
    echo [WARN] bridge\.env.example missing ? skip bridge env.
  )
) else (
  echo [OK] bridge\.env already exists ? left untouched.
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

echo [3/3] Starting apps...
echo.

set "START_BRIDGE=N"
set /p START_BRIDGE=Start WhatsApp bridge now? [y/N]: 

if /I "%START_BRIDGE%"=="Y" (
  echo [BRIDGE] starting npm run bridge ...
  start "TAXIPRO Bridge" cmd /k "cd /d "%~dp0" && npm run bridge"
  timeout /t 2 /nobreak >nul
) else (
  echo [BRIDGE] skipped ? run later: npm run bridge
)

REM Ops Center (admin)
start "TAXIPRO Ops Center" cmd /k "cd /d "%~dp0" && npm run dev:ops"
timeout /t 2 /nobreak >nul

REM Ride App (unified passenger+driver)
if exist "app.html" (
  start "TAXIPRO Ride App" cmd /k "cd /d "%~dp0" && npm run dev:app"
) else (
  echo [WARN] app.html missing ? falling back to legacy passenger + driver
  start "TAXIPRO Passenger (legacy)" cmd /k "cd /d "%~dp0" && npm run dev:passenger"
  timeout /t 1 /nobreak >nul
  start "TAXIPRO Driver (legacy)" cmd /k "cd /d "%~dp0" && npm run dev:driver"
)

echo.
echo  ----------------------------------------
echo   Ops Center : http://localhost:5275/admin.html
echo   Ride App   : http://localhost:5273/app.html
echo   Bridge     : http://localhost:3000/health   (if started)
echo  ----------------------------------------
echo   Fill .env with NEW Firebase + GAS + WhatsApp group before go-live.
echo   See DEPLOY.md / GUIDE.md ? never commit secrets.
echo  ----------------------------------------
echo.
pause
