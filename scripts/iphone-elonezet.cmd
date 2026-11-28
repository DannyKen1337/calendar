@echo off
rem Tavern teszt iPhone 17 elonezet: ha a tesztkornyezet nem fut, kulon ablakban elinditja (bongeszo nelkul),
rem megvarja, majd telefonkent megnyitja (scripts\iphone-elonezet.mjs).
title Tavern teszt - iPhone 17
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue)) { Write-Host 'A tesztkornyezet elindul, varj egy kicsit...'; Start-Process -FilePath '%~dp0teszt-inditas.cmd' -ArgumentList '-NoOpen'; for ($i = 0; $i -lt 240; $i++) { try { Invoke-WebRequest -Uri 'http://localhost:3100/admin' -UseBasicParsing -TimeoutSec 60 -MaximumRedirection 0 | Out-Null; break } catch { if ($_.Exception.Response) { break } }; Start-Sleep 1 } }"
node scripts\iphone-elonezet.mjs
if errorlevel 1 pause
