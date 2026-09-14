@echo off
chcp 65001 >nul
cd /d "%~dp0"
:loop
echo.
echo  Starting WhatsApp bridge...
node multi-bot.js
echo.
echo  Bridge stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
