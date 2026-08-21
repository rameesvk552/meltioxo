param(
    [string]$PosUrl,
    [string]$PrinterName
)

$ErrorActionPreference = 'Stop'
$configurationPath = Join-Path $PSScriptRoot 'wayon-pos-config.json'

if (Test-Path -LiteralPath $configurationPath) {
    $configuration = Get-Content -Raw -LiteralPath $configurationPath | ConvertFrom-Json
    if (-not $PosUrl) { $PosUrl = $configuration.pos_url }
    if (-not $PrinterName) { $PrinterName = $configuration.printer_name }
}

if (-not $PosUrl) { $PosUrl = 'https://perfume.wayon.in/app/retail-sales/new' }
if (-not $PrinterName) { $PrinterName = 'HP Smart Tank 580' }

$printer = Get-CimInstance -ClassName Win32_Printer | Where-Object {
    $_.Name -eq $PrinterName -or $_.Name -like "*$PrinterName*" -or $_.DriverName -like "*$PrinterName*"
} | Select-Object -First 1

if (-not $printer) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "The '$PrinterName' printer is not installed or available. Check the printer, then open Wayon POS again.",
        'Wayon POS printer unavailable',
        'OK',
        'Error'
    ) | Out-Null
    exit 1
}

$defaultResult = Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter
if ($defaultResult.ReturnValue -ne 0) {
    throw "Windows could not select '$($printer.Name)' as the default printer."
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

$profilePath = Join-Path $env:LOCALAPPDATA 'WayonPOSBrowser'
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

$browserArguments = @(
    "--user-data-dir=`"$profilePath`"",
    '--no-first-run',
    '--kiosk-printing',
    '--start-maximized',
    "--app=$PosUrl"
)

Start-Process -FilePath $browserPath -ArgumentList $browserArguments
