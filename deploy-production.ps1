<#!
Builds the Perfume ERP locally and deploys the finished files to EC2.
EC2 never runs a frontend build or npm install.

Run from PowerShell:
  .\deploy-production.ps1
#>

[CmdletBinding()]
param(
  [string]$KeyPath = 'C:\Users\ACER\Downloads\wayon.pem',
  [string]$HostName = '43.204.27.127',
  [string]$UserName = 'ec2-user'
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$releaseArchive = Join-Path $projectRoot 'perfume-erp-release.tgz'
$dependenciesArchive = Join-Path $projectRoot 'perfume-erp-server-node_modules.tgz'
$remote = "$UserName@$HostName"
$remoteIncoming = '/mnt/recovery/perfume-erp/incoming/'

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "EC2 key not found: $KeyPath"
}

Push-Location (Join-Path $projectRoot 'client')
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Local frontend build failed.' }
}
finally {
  Pop-Location
}

Push-Location $projectRoot
try {
  & tar.exe -czf $releaseArchive --exclude=server/node_modules --exclude=server/.env client/dist server
  if ($LASTEXITCODE -ne 0) { throw 'Release packaging failed.' }

  & tar.exe -czf $dependenciesArchive server/node_modules
  if ($LASTEXITCODE -ne 0) { throw 'Dependency packaging failed.' }

  & scp.exe -i $KeyPath -o StrictHostKeyChecking=no $releaseArchive $dependenciesArchive (Join-Path $projectRoot 'deploy-perfume-erp.sh') (Join-Path $projectRoot 'perfume.wayon.in.conf') "$remote`:$remoteIncoming"
  if ($LASTEXITCODE -ne 0) { throw 'Upload to EC2 failed.' }

  & ssh.exe -i $KeyPath -o StrictHostKeyChecking=no $remote 'bash /mnt/recovery/perfume-erp/incoming/deploy-perfume-erp.sh'
  if ($LASTEXITCODE -ne 0) { throw 'EC2 deployment failed.' }

  & ssh.exe -i $KeyPath -o StrictHostKeyChecking=no $remote 'curl -fsSI https://perfume.wayon.in/ | head -1; curl -fsS http://127.0.0.1:5001/health'
  if ($LASTEXITCODE -ne 0) { throw 'Production health check failed.' }
}
finally {
  Pop-Location
}

Write-Host 'Deployment complete: https://perfume.wayon.in' -ForegroundColor Green
