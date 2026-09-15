@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ========================================
echo   TAXIPRO - start MongoDB (local)
echo  ========================================
echo.

where mongod >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [OK] mongod found in PATH
  if not exist "data\mongo" mkdir "data\mongo"
  mongod --dbpath "%~dp0data\mongo" --bind_ip 127.0.0.1 --port 27017
  exit /b %ERRORLEVEL%
)

sc query MongoDB >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [INFO] Starting Windows service MongoDB...
  net start MongoDB
  exit /b %ERRORLEVEL%
)

where docker >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [INFO] Using Docker mongo:7 on port 27017
  docker start taxipro-mongo 2>nul
  if errorlevel 1 docker run -d --name taxipro-mongo -p 27017:27017 mongo:7
  echo [OK] Mongo should be at mongodb://127.0.0.1:27017/taxipro
  exit /b 0
)

echo [ERROR] MongoDB not found.
echo   Install MongoDB Community, add mongod to PATH, or install Docker.
echo   Then set server/.env MONGODB_URI=mongodb://127.0.0.1:27017/taxipro
echo   and run: npm run dev:api
pause
exit /b 1
