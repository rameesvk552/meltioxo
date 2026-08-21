param(
    [string]$PosUrl = 'https://perfume.wayon.in/app/retail-sales/new',
    [string]$PrinterSearch = 'HP Smart Tank 580'
)

$ErrorActionPreference = 'Stop'

Write-Host 'Wayon POS automatic printing setup' -ForegroundColor Cyan
Write-Host 'Checking the printer and browser...'

$matchingPrinters = @(Get-CimInstance -ClassName Win32_Printer | Where-Object {
    $_.Name -like "*$PrinterSearch*" -or $_.DriverName -like "*$PrinterSearch*"
})

if ($matchingPrinters.Count -eq 0) {
    throw "The '$PrinterSearch' printer is not installed. Install the HP Smart Tank 580 in HP Smart or Windows Printers & scanners, then run this setup again."
}

$printer = $matchingPrinters | Where-Object { $_.Name -eq $PrinterSearch } | Select-Object -First 1
if (-not $printer) {
    $printer = $matchingPrinters | Select-Object -First 1
}

$defaultResult = Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter
if ($defaultResult.ReturnValue -ne 0) {
    throw "Windows could not make '$($printer.Name)' the default printer (error $($defaultResult.ReturnValue))."
}

$browserCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $browserPath) {
    throw 'Microsoft Edge or Google Chrome is required for automatic printing.'
}

$installDirectory = Join-Path $env:LOCALAPPDATA 'WayonPOS'
New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null

$launcherSource = Join-Path $PSScriptRoot 'start-wayon-pos-silent-print.ps1'
$launcherDestination = Join-Path $installDirectory 'start-wayon-pos-silent-print.ps1'
Copy-Item -LiteralPath $launcherSource -Destination $launcherDestination -Force

$configuration = [ordered]@{
    pos_url = $PosUrl
    printer_name = $printer.Name
}
$configuration | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installDirectory 'wayon-pos-config.json') -Encoding UTF8

$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'Wayon POS.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherDestination`""
$shortcut.WorkingDirectory = $installDirectory
$shortcut.IconLocation = "$browserPath,0"
$shortcut.Description = 'Wayon POS with automatic invoice printing'
$shortcut.Save()

Write-Host ''
Write-Host 'Setup completed successfully.' -ForegroundColor Green
Write-Host "Printer: $($printer.Name)"
Write-Host "Desktop shortcut: $shortcutPath"
Write-Host 'Opening Wayon POS. Sign in once in this dedicated window.'

Start-Process -FilePath $shortcutPath
