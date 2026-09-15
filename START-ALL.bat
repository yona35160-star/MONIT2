@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO - start 2 screens
echo  ========================================
echo.

if not exist "node_modules" (
  echo [INFO] First run - launching SETUP.bat
  call SETUP.bat
  exit /b %ERRORLEVEL%
)

start "TAXIPRO Ops Center" cmd /k "cd /d "%~dp0" && npm run dev:ops"
timeout /t 2 /nobreak >nul
start "TAXIPRO Ride App" cmd /k "cd /d "%~dp0" && npm run dev:app"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5275/admin.html"
start "" "http://localhost:5273/app.html"

echo   Ops Center : http://localhost:5275/admin.html
echo   Ride App   : http://localhost:5273/app.html
echo.