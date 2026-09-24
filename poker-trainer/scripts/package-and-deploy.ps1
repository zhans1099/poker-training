[CmdletBinding()]
param(
  [ValidatePattern('^[A-Za-z0-9_.@-]+$')]
  [string]$Server = '',

  [string]$EnvFile = '.env.docker',

  [switch]$PackageOnly,
  [switch]$SkipBuild,
  [switch]$KeepPackage,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnv = Join-Path $projectRoot $EnvFile
$webRoot = Join-Path $projectRoot 'apps/web'
$standaloneRoot = Join-Path $webRoot '.next/standalone'
$staticRoot = Join-Path $webRoot '.next/static'
$releaseId = Get-Date -Format 'yyyyMMdd-HHmmss'
$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) "poker-trainer-$releaseId"
$outputRoot = Join-Path $projectRoot 'releases'
$archiveName = 'poker-trainer-latest.tar.gz'
$archivePath = Join-Path $outputRoot $archiveName
$remoteRoot = '/home/poker-trainer'
$remoteIncoming = "$remoteRoot/.incoming-$releaseId"
$remoteArchive = "$remoteRoot/$archiveName"

function Copy-DirectoryTree {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  & robocopy $Source $Destination /E /SL /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "Failed to copy directory tree: $Source"
  }
}

if (-not $PackageOnly -and [string]::IsNullOrWhiteSpace($Server)) {
  throw 'Server is required unless -PackageOnly is used.'
}
if (-not (Test-Path -LiteralPath $resolvedEnv -PathType Leaf)) {
  throw "Deployment environment file not found: $resolvedEnv. Copy .env.docker.example to .env.docker and fill it first."
}

$requiredKeys = @(
  'MYSQL_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'AUTH_SECRET',
  'APP_LOGIN_USERNAME',
  'APP_LOGIN_PASSWORD'
)
$environmentText = Get-Content -Raw -LiteralPath $resolvedEnv
foreach ($key in $requiredKeys) {
  if ($environmentText -notmatch "(?m)^$key=(?!\s*$|replace-with-).+") {
    throw "Missing or placeholder deployment value: $key"
  }
}

try {
  New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

  if (-not $SkipBuild) {
    Push-Location $projectRoot
    try {
      & pnpm build
      if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed.' }
    }
    finally {
      Pop-Location
    }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $standaloneRoot 'apps/web/server.js'))) {
    throw 'Next.js standalone server was not generated.'
  }

  $releaseRoot = Join-Path $stageRoot 'release'
  Copy-DirectoryTree -Source $standaloneRoot -Destination $releaseRoot
  $copiedLocalEnvironment = Join-Path $releaseRoot '.env'
  if (Test-Path -LiteralPath $copiedLocalEnvironment) {
    Remove-Item -Force -LiteralPath $copiedLocalEnvironment
  }
  $releaseStatic = Join-Path $releaseRoot 'apps/web/.next/static'
  Copy-DirectoryTree -Source $staticRoot -Destination $releaseStatic

  $publicRoot = Join-Path $webRoot 'public'
  if (Test-Path -LiteralPath $publicRoot -PathType Container) {
    Copy-DirectoryTree -Source $publicRoot -Destination (Join-Path $releaseRoot 'apps/web/public')
  }

  $sqlTarget = Join-Path $stageRoot 'sql'
  New-Item -ItemType Directory -Path $sqlTarget -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot 'packages/database/sql/poker_trainer_schema.sql') -Destination (Join-Path $sqlTarget '01-schema.sql')
  Copy-Item -LiteralPath (Join-Path $projectRoot 'packages/database/sql/poker_trainer_seed.sql') -Destination (Join-Path $sqlTarget '02-seed.sql')
  Copy-Item -LiteralPath (Join-Path $projectRoot 'docker-compose.yml') -Destination (Join-Path $stageRoot 'docker-compose.yml')
  Copy-Item -LiteralPath $resolvedEnv -Destination (Join-Path $stageRoot '.env')

  Push-Location $outputRoot
  try {
    & tar -czf $archiveName -C $stageRoot .
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create the release archive.' }
  }
  finally {
    Pop-Location
  }

  if ($PackageOnly) {
    Write-Host "Release package created: $archivePath"
    return
  }

  & ssh $Server "mkdir -p '$remoteRoot' && rm -rf '$remoteIncoming' && mkdir -p '$remoteIncoming'"
  if ($LASTEXITCODE -ne 0) { throw 'Failed to prepare the fixed remote deployment directory.' }
  & scp $archivePath "${Server}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) { throw 'Failed to upload the release archive.' }

  $remoteSteps = @(
    "tar -xzf '$remoteArchive' -C '$remoteIncoming'",
    "chmod 600 '$remoteIncoming/.env'",
    "if [ -f '$remoteRoot/docker-compose.yml' ] && [ -f '$remoteRoot/.env' ]; then cd '$remoteRoot' && docker compose --env-file .env down; fi",
    "rm -rf '$remoteRoot/release' '$remoteRoot/sql'",
    "rm -f '$remoteRoot/docker-compose.yml' '$remoteRoot/.env'",
    "mv '$remoteIncoming/release' '$remoteRoot/release'",
    "mv '$remoteIncoming/sql' '$remoteRoot/sql'",
    "mv '$remoteIncoming/docker-compose.yml' '$remoteRoot/docker-compose.yml'",
    "mv '$remoteIncoming/.env' '$remoteRoot/.env'",
    "rm -rf '$remoteIncoming'",
    "rm -f '$remoteArchive'"
  )
  if (-not $NoStart) {
    $remoteSteps += "cd '$remoteRoot' && docker compose --env-file .env up -d --pull never --no-build"
  }
  $remoteCommand = $remoteSteps -join ' && '
  & ssh $Server $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw 'Remote extraction or Docker Compose startup failed.' }

  Write-Host "Latest release deployed to ${Server}:$remoteRoot"
  if ($NoStart) {
    Write-Host "Start with: cd '$remoteRoot' && docker compose --env-file .env up -d --pull never --no-build"
  }
  else {
    Write-Host 'Docker Compose services started. No image build or pull was performed on the server.'
  }
}
finally {
  if (Test-Path -LiteralPath $stageRoot) {
    Remove-Item -Recurse -Force -LiteralPath $stageRoot
  }
  if (-not $PackageOnly -and -not $KeepPackage -and (Test-Path -LiteralPath $archivePath)) {
    Remove-Item -Force -LiteralPath $archivePath
  }
}
