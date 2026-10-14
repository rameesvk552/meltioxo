param(
    [string]$PosUrl = 'https://perfume.wayon.in/app/retail-sales/new',
    [string]$PrinterName = 'HP Smart Tank 580'
)

$ErrorActionPreference = 'Stop'

$matchingPrinters = @(Get-CimInstance -ClassName Win32_Printer | Where-Object {
    $_.Name -like "*$PrinterName*" -or $_.DriverName -like "*$PrinterName*"
})

if ($matchingPrinters.Count -eq 0) {
    Write-Error "The '$PrinterName' printer is not installed. Install it in Windows or HP Smart, then run this launcher again."
    exit 1
}

$printer = $matchingPrinters[0]
$defaultResult = Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter
if ($defaultResult.ReturnValue -ne 0) {
    Write-Error "Windows could not make '$($printer.Name)' the default printer (error $($defaultResult.ReturnValue))."
    exit 1
}

$browserCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browserPath = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $browserPath) {
    Write-Error 'Microsoft Edge or Google Chrome is required for silent POS printing.'
    exit 1
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

Write-Host "Default printer: $($printer.Name)"
Write-Host 'Opening Wayon POS with automatic printing enabled...'
Start-Process -FilePath $browserPath -ArgumentList $browserArguments
