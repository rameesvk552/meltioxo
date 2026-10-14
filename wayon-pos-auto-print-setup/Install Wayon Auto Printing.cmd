@echo off
title Wayon POS Automatic Printing Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-wayon-auto-printing.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not complete. Read the error above, then try again.
)
echo.
pause
