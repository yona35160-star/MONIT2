@echo off
chcp 65001 >nul
cd /d "%~dp0"
set DATA=%~dp0.mongo-data
set LOG=%~dp0.mongo-logs
if not exist "%DATA%" mkdir "%DATA%"
if not exist "%LOG%" mkdir "%LOG%"
set MONGOD=C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe
if not exist "%MONGOD%" (
  echo [ERROR] mongod.exe not found. Reinstall MongoDB.Server via winget.
  pause & exit /b 1
)
echo Starting MongoDB on 127.0.0.1:27017 ...
echo If this fails, approve UAC / start Windows service "MongoDB" as Admin once.
start "TAXIPRO MongoDB" "%MONGOD%" --dbpath "%DATA%" --logpath "%LOG%\mongod.log" --bind_ip 127.0.0.1 --port 27017
timeout /t 3 /nobreak >nul
echo URI: mongodb://127.0.0.1:27017/taxipro
echo.