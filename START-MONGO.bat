@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  TAXIPRO - start local MongoDB
echo.

where mongod >nul 2>&1
if not errorlevel 1 goto :have_mongod

where docker >nul 2>&1
if not errorlevel 1 (
  echo [INFO] mongod not in PATH - using Docker mongo:7 on port 27017
  docker start taxipro-mongo 2>nul
  if errorlevel 1 docker run -d --name taxipro-mongo -p 27017:27017 mongo:7
  echo [OK] Mongo should be at mongodb://127.0.0.1:27017/taxipro
  exit /b 0
)

echo [ERROR] mongod not found in PATH.
echo Install MongoDB Community Server, or use Atlas URI in bridge\.env / server\.env
echo See START.md section Mongo / Atlas.
pause
exit /b 1

:have_mongod
REM Prefer Windows service if installed
sc query MongoDB >nul 2>&1
if not errorlevel 1 (
  echo [INFO] Found MongoDB Windows service - starting...
  net start MongoDB >nul 2>&1
  if errorlevel 1 (
    echo [WARN] Could not start service (need Admin/UAC). Falling back to mongod.exe...
  ) else (
    echo [OK] MongoDB service running.
    goto :ready
  )
)

if not exist "data\mongo" mkdir "data\mongo"
echo [INFO] Starting mongod on 127.0.0.1:27017 dbpath=data\mongo
start "TAXIPRO MongoDB" cmd /k "mongod --dbpath \"%~dp0data\mongo\" --bind_ip 127.0.0.1 --port 27017"

:ready
timeout /t 2 /nobreak >nul
where mongosh >nul 2>&1
if not errorlevel 1 (
  mongosh --quiet --eval "db.runCommand({ ping: 1 })" mongodb://127.0.0.1:27017/taxipro
  if errorlevel 1 (
    echo [WARN] ping failed - wait a few seconds and retry mongosh.
  ) else (
    echo [OK] ping taxipro OK
  )
)

echo.
echo  URI: mongodb://127.0.0.1:27017/taxipro
echo  Put the same value in bridge\.env and server\.env as MONGODB_URI
echo  Atlas alternative: see START.md
echo.
exit /b 0
