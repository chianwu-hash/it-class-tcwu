Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot 'docs\development\agent-sync-state.json'

Write-Host 'Running preflight: PowerShell source encoding'
& (Join-Path $PSScriptRoot 'assert-no-nonascii-ps1.ps1') -RepoPath $repoRoot

Write-Host 'Running preflight: Agent state ASCII values'
& (Join-Path $PSScriptRoot 'assert-agent-state-ascii.ps1') -StatePath $statePath

Write-Host 'Preflight passed.'
