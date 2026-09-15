@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO - Mongo API  (port 4000)
echo  ========================================
echo.

if not exist "server\.env" (
  if exist "server\.env.example" (
    copy /Y "server\.env.example" "server\.env" >nul
    echo [OK] Created server\.env from template
  )
)

if not exist "server\node_modules" (
  echo [INFO] npm install in server\
  pushd server
  call npm install
  if errorlevel 1 (
    echo [ERROR] server npm install failed
    popd & pause & exit /b 1
  )
  popd
)

echo Point the apps at this API: VITE_WEBAPP_URL=http://localhost:4000
echo Health: http://localhost:4000/health
echo.
call npm run dev:api
