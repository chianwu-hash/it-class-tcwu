$ErrorActionPreference = 'Stop'
$taskCredential = Join-Path $env:LOCALAPPDATA 'it-class-tcwu\credentials\ai-help-lab.dpapi'
$taskOriginalKey = $env:AI_HELP_LAB_API_KEY
try {
    if (-not $env:AI_HELP_LAB_API_KEY -and (Test-Path -LiteralPath $taskCredential)) {
        $taskSecure = Get-Content -Raw -LiteralPath $taskCredential -Encoding utf8 | ConvertTo-SecureString
        $env:AI_HELP_LAB_API_KEY = [Net.NetworkCredential]::new('', $taskSecure).Password
    }
    & node (Join-Path $PSScriptRoot 'server.cjs')
    if ($LASTEXITCODE -ne 0) { throw ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('6Kmm6amX5Y+w57WQ5p2f5pmC5Zue5aCx6Yyv6Kqk44CC'))) }
}
finally {
    $env:AI_HELP_LAB_API_KEY = $taskOriginalKey
    $taskSecure = $null
    $taskOriginalKey = $null
}
