@echo off
rem Tavern teszt: elinditja a teszt-inditas.ps1-et (az asztali parancsikon ezt hivja).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0teszt-inditas.ps1"
