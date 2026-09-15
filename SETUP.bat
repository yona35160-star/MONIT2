@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO / MONIT2 - SETUP
echo   Mongo + 2 screens (Ops + Ride)
echo  ========================================
echo.

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [OK] Created .env from .env.example
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
    echo [WARN] bridge\.env.example missing.
  )
) else (
  echo [OK] bridge\.env already exists - left untouched.
)

if not exist "server\.env" (
  if exist "server\.env.example" (
    copy /Y "server\.env.example" "server\.env" >nul
    echo [OK] Created server\.env from template.
  )
)

echo.
echo [0/3] MongoDB...
if exist "START-MONGO.bat" (
  call START-MONGO.bat
) else (
  echo [WARN] START-MONGO.bat missing - start Mongo manually or use Atlas.
)

echo [1/3] npm install (root)...
call npm install
if errorlevel 1 ( echo [ERROR] root npm install failed & pause & exit /b 1 )

echo [2/3] npm install (bridge)...
pushd bridge
call npm install
if errorlevel 1 ( echo [ERROR] bridge npm install failed & popd & pause & exit /b 1 )
popd

if exist "server\package.json" (
  echo [2b] npm install (server)...
  pushd server
  call npm install
  if errorlevel 1 ( echo [ERROR] server npm install failed & popd & pause & exit /b 1 )
  popd
)

echo [3/3] Starting apps...
if exist "server\package.json" (
  start "TAXIPRO API :4000" cmd /k "cd /d "%~dp0server" && npm run dev"
  timeout /t 2 /nobreak >nul
)

start "TAXIPRO Ops Center" cmd /k "cd /d "%~dp0" && npm run dev:ops"
timeout /t 2 /nobreak >nul
start "TAXIPRO Ride App" cmd /k "cd /d "%~dp0" && npm run dev:app"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5275/admin.html"
start "" "http://localhost:5273/app.html"

echo.
echo  ----------------------------------------
echo   Mongo     : mongodb://127.0.0.1:27017/taxipro  (or Atlas)
echo   API       : http://localhost:4000              (when server/ exists)
echo   Ops       : http://localhost:5275/admin.html
echo   Ride App  : http://localhost:5273/app.html
echo   Bridge    : SETUP-BRIDGE.bat
echo  ----------------------------------------
echo [OK] SETUP finished - apps are starting in new windows.
exit /b 0
