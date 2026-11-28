# Tavern tesztkörnyezet Windowson (az asztali „Tavern teszt – indító” indítja a teszt-inditas.cmd-n keresztül).
# Ugyanaz, mint a Macen a teszt-inditas.sh: a mostani munkapéldányt futtatja (http://localhost:3100) a teszt
# adatbázissal (TavernTeszt, lib/testEnv.js): csak a tesztfiókokkal lehet belépni, levél és telefonos értesítés nem
# megy ki. A beállítások (adatbázis címe, kulcsok) a repón kívül vannak: %APPDATA%\TavernTeszt\env.
# Az ablak bezárásakor (vagy Ctrl+C-re) a szerver leáll. -NoOpen: nem nyitja meg a böngészőt.
param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'Tavern tesztkörnyezet'

$Repo = Split-Path -Parent $PSScriptRoot
$Dir = Join-Path $env:APPDATA 'TavernTeszt'
$EnvFile = Join-Path $Dir 'env'
$CopyMark = Join-Path $Dir 'elso-masolat-kesz'
$Port = 3100
$Url = "http://localhost:$Port/admin"

function Wait-Close { Write-Host ''; Read-Host 'Nyomj Entert a bezáráshoz' | Out-Null; exit 1 }
function New-Secret { -join ((1..48) | ForEach-Object { '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'[(Get-Random -Maximum 62)] }) }

Write-Host "Tavern tesztkörnyezet – $Url"
Write-Host 'Leállítás: zárd be ezt az ablakot (vagy Ctrl+C).'
Write-Host ''

# első indításkor a beállítófájl elkészül (a kulcsok véletlenszerűek); csak az adatbázis címét kell beírni
if (-not (Test-Path $EnvFile)) {
  New-Item -ItemType Directory -Force $Dir | Out-Null
  $lines = @(
    '# Tavern tesztkörnyezet beállításai (scripts/teszt-inditas.ps1). Ne töltsd fel sehova.',
    '# A MongoDB Atlas kapcsolódási címe (Atlas › Connect › Drivers), ugyanaz a fürt, mint az élő oldalé:',
    'MONGODB_URI=',
    'MONGODB_DB=TavernTeszt',
    'TEST_ENV=1',
    'TEST_USERS=admin2,TavernAdmin',
    "JWT_SECRET=$(New-Secret)",
    "TEST_SETUP_SECRET=$(New-Secret)",
    '# Ha a tesztben kimenő leveleket is látni szeretnéd, ide írd a saját címed (különben nem megy ki levél):',
    '# TEST_MAIL_TO=',
    '# A Galéria feltöltéséhez (nem kötelező): IMGBB_API_KEY='
  )
  [IO.File]::WriteAllLines($EnvFile, $lines, (New-Object Text.UTF8Encoding $false))
}

# a beállítások beolvasása (KULCS=érték; az idézőjelek levágva)
$cfg = @{}
foreach ($line in [IO.File]::ReadAllLines($EnvFile)) {
  if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$') {
    $v = $Matches[2].Trim()
    if ($v.Length -ge 2 -and (($v[0] -eq '"' -and $v[-1] -eq '"') -or ($v[0] -eq "'" -and $v[-1] -eq "'"))) { $v = $v.Substring(1, $v.Length - 2) }
    $cfg[$Matches[1]] = $v
  }
}
if (-not $cfg['MONGODB_URI'] -or $cfg['MONGODB_URI'] -eq '[Sensitive]') {
  Write-Host 'Hiányzik az adatbázis címe (MONGODB_URI) a beállításokból. Megnyitom a fájlt: írd be a MongoDB Atlas'
  Write-Host 'kapcsolódási címét (Atlas › Connect › Drivers) a MONGODB_URI= után, mentsd el, és indítsd újra.'
  Start-Process notepad.exe -ArgumentList "`"$EnvFile`""
  Wait-Close
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host 'A tesztkörnyezet már fut, megnyitom.'
  if (-not $NoOpen) { Start-Process $Url }; Start-Sleep 2; exit 0
}

foreach ($k in $cfg.Keys) { [Environment]::SetEnvironmentVariable($k, $cfg[$k], 'Process') }
# külön build-mappa (.next-teszt), hogy a tesztek szerverével (.next) ne akadjon össze
$env:NEXT_DIST_DIR = '.next-teszt'
# belépés nélkül a belépőre visz (nem az élő oldalra): lib/testEnv.js isLocalTest
$env:TEST_LOCAL = '1'
# a weboldal linkjei (Naptár, Előrendelés, Ligák, Asztalfoglalás, a beágyazott ablakok) a tesztkörnyezetre mutassanak, ne az
# élő oldalra (weblap/lib/calendar.js CALENDAR_URL; APP_URL; lib/storeInfo.js); a beállítófájl felülírhatja
foreach ($k in 'CALENDAR_URL', 'APP_URL', 'NEXT_PUBLIC_SITE_URL') { if (-not $cfg[$k]) { [Environment]::SetEnvironmentVariable($k, "http://localhost:$Port", 'Process') } }
Set-Location $Repo
$server = Start-Process node -ArgumentList 'node_modules/next/dist/bin/next', 'dev', '-p', "$Port" -NoNewWindow -PassThru

function Stop-Server {
  Write-Host ''; Write-Host 'Leállítás…'
  cmd.exe /c "taskkill /T /F /PID $($server.Id) >nul 2>&1"
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

try {
  # ha elindult, megnyitja a böngészőben (az első indításkor előbb átmásolja az éles adatokat a teszt adatbázisba)
  $ready = $false
  for ($i = 0; $i -lt 180 -and -not $server.HasExited; $i++) {
    try { Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 60 -MaximumRedirection 0 -ErrorAction Stop | Out-Null; $ready = $true; break }
    catch { if ($_.Exception.Response) { $ready = $true; break } }
    Start-Sleep 1
  }
  if ($ready -and -not (Test-Path $CopyMark)) {
    Write-Host ''; Write-Host 'Első indítás: friss másolat az éles adatokról a teszt adatbázisba (az élőt csak olvassa)…'
    try {
      $r = Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/test-env" -Headers @{ Authorization = "Bearer $($cfg['TEST_SETUP_SECRET'])" } -TimeoutSec 300
      if ($r.success) { New-Item -ItemType File -Force $CopyMark | Out-Null; Write-Host 'Kész.' }
    } catch { Write-Host "A másolás nem sikerült: $($_.Exception.Message). A következő indításkor újra próbálja." }
  }
  if ($ready -and -not $NoOpen) { Start-Process $Url }
  if ($ready) { Write-Host ''; Write-Host "Fut: $Url" }
  Wait-Process -Id $server.Id
} finally {
  Stop-Server
}
