@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  TAXIPRO - WhatsApp bridge (new bot)
echo.

if not exist "bridge\node_modules" (
  pushd bridge
  call npm install
  if errorlevel 1 (popd & pause & exit /b 1)
  popd
)

if not exist "bridge\.env" (
  if exist "bridge\.env.example" copy /Y "bridge\.env.example" "bridge\.env" >nul
)

start "TAXIPRO Bridge" cmd /k "cd /d "%~dp0" && npm run bridge"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000/health"
echo Bridge health: http://localhost:3000/health
echo Scan QR from the bridge window / GUIDE.md
echo.
pause