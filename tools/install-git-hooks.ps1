Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$hooksPath = Join-Path $repoRoot '.githooks'

if (-not (Test-Path -LiteralPath $hooksPath)) {
    throw "Missing hooks directory: $hooksPath"
}

git -C $repoRoot config core.hooksPath .githooks

if ($LASTEXITCODE -ne 0) {
    throw 'Failed to configure core.hooksPath.'
}

Write-Host "Git hooks installed from $hooksPath"
