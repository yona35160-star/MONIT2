@echo off
chcp 65001 >nul
REM ================================================================
REM  TAXIPRO — Build for deployment
REM  Creates dist\passenger, dist\driver, dist\admin
REM  Drag any of these folders to https://app.netlify.com/drop
REM ================================================================
cd /d "%~dp0"

echo Building all three apps...
call npm run build:all || (echo [ERROR] Build failed & pause & exit /b 1)

echo.
echo  ========================================
echo   Build complete! Output folders:
echo     dist\passenger  -^> NEW Netlify site (not taxiil)
echo     dist\driver     -^> NEW Netlify site (not taxiproil)
echo     dist\admin      -^> NEW Netlify site (not menachemadmin)
echo   Drag a folder to https://app.netlify.com/drop
echo   (or to the existing site's Deploys page)
echo  ========================================
explorer "%~dp0dist"
pause
