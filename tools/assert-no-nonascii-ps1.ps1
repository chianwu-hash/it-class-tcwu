param(
    [string]$RepoPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
    $RepoPath = Split-Path -Parent $PSScriptRoot
}

$root = Resolve-Path -LiteralPath $RepoPath
$excludedSegments = @(
    '\.git\'
    '\node_modules\'
)

$files = Get-ChildItem -Path $root -Recurse -File -Filter '*.ps1' |
    Where-Object {
        $fullName = $_.FullName
        foreach ($segment in $excludedSegments) {
            if ($fullName -like "*$segment*") {
                return $false
            }
        }
        return $true
    } |
    Sort-Object FullName

$violations = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $badOffsets = @(for ($i = 0; $i -lt $bytes.Length; $i++) {
        if ($bytes[$i] -gt 127) {
            $i
        }
    })

    if ($badOffsets.Count -gt 0) {
        $preview = ($badOffsets | Select-Object -First 5 | ForEach-Object { $_ + 1 }) -join ', '
        $violations.Add("$($file.FullName) -> non-ASCII bytes at offsets $preview")
    }
}

if ($violations.Count -gt 0) {
    Write-Error ("Non-ASCII bytes are not allowed in PowerShell source files.`n" + ($violations -join "`n"))
}

Write-Host "PS1 encoding check passed: $($files.Count) files scanned, all ASCII-only."
