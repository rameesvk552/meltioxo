@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-wayon-pos-silent-print.ps1"
if errorlevel 1 pause
