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

REM Ensure a real BRIDGE_API_KEY (not placeholder) and sync to root .env
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='bridge\.env'; if (!(Test-Path $p)) { exit 1 }; $t=Get-Content $p -Raw; $need=$false; if ($t -notmatch 'BRIDGE_API_KEY=') { $need=$true } else { $v=([regex]::Match($t,'BRIDGE_API_KEY=(.*)')).Groups[1].Value.Trim(); if (-not $v -or $v -eq 'replace_with_strong_random_key_here') { $need=$true } }; if ($need) { $k=-join ((48..57+97..122+65..90)|Get-Random -Count 40|%%{[char]$_}); if ($t -match 'BRIDGE_API_KEY=') { $t=[regex]::Replace($t,'BRIDGE_API_KEY=.*',\"BRIDGE_API_KEY=$k\") } else { $t=\"BRIDGE_API_KEY=$k`r`n$t\" }; Set-Content -Path $p -Value $t -NoNewline; if (Test-Path .env) { $r=Get-Content .env -Raw; if ($r -match 'VITE_BRIDGE_API_KEY=') { $r=[regex]::Replace($r,'VITE_BRIDGE_API_KEY=.*',\"VITE_BRIDGE_API_KEY=$k\") } else { $r=$r.TrimEnd()+\"`r`nVITE_BRIDGE_API_KEY=$k`r`n\" }; Set-Content -Path .env -Value $r -NoNewline }; Write-Host '[OK] Generated BRIDGE_API_KEY and synced VITE_BRIDGE_API_KEY' } else { Write-Host '[OK] BRIDGE_API_KEY already set' }"

start "TAXIPRO Bridge" cmd /k "cd /d "%~dp0bridge" && node multi-bot.js"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000/health"
echo Bridge health: http://localhost:3000/health
echo Scan QR from the bridge terminal window.
echo.
pause