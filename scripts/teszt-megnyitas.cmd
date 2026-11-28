@echo off
rem Tavern teszt megnyitasa a gepen (asztali ikonok: admin, weboldal): ha a tesztkornyezet nem fut, kulon ablakban
rem elinditja (bongeszo nelkul), megvarja, majd megnyitja a bongeszoben. Parameter: az oldal utja (/admin vagy /).
title Tavern teszt
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue)) { Write-Host 'A tesztkornyezet elindul, varj egy kicsit...'; Start-Process -FilePath '%~dp0teszt-inditas.cmd' -ArgumentList '-NoOpen'; for ($i = 0; $i -lt 240; $i++) { try { Invoke-WebRequest -Uri 'http://localhost:3100/admin' -UseBasicParsing -TimeoutSec 60 -MaximumRedirection 0 | Out-Null; break } catch { if ($_.Exception.Response) { break } }; Start-Sleep 1 } }; $p = '%~1'; if (-not $p) { $p = '/admin' }; Start-Process ('http://localhost:3100' + $p)"
