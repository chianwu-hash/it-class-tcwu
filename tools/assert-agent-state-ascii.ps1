param(
    [string]$StatePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\development\agent-sync-state.json'
}

if (-not (Test-Path -LiteralPath $StatePath)) {
    Write-Host "Agent state check skipped: file not found at $StatePath"
    exit 0
}

function Test-AsciiString {
    param([string]$Value)
    return ($Value.ToCharArray().Where({ [int][char]$_ -gt 127 }).Count -eq 0)
}

function Assert-AsciiValues {
    param(
        [object]$Node,
        [string]$PathLabel
    )

    if ($null -eq $Node) {
        return
    }

    if ($Node -is [string]) {
        if (-not (Test-AsciiString -Value $Node)) {
            throw "Non-ASCII string value found at $PathLabel"
        }
        return
    }

    if ($Node -is [System.Collections.IDictionary]) {
        foreach ($key in $Node.Keys) {
            Assert-AsciiValues -Node $Node[$key] -PathLabel "$PathLabel.$key"
        }
        return
    }

    if ($Node -is [psobject]) {
        $properties = $Node.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' }
        if ($properties.Count -gt 0) {
            foreach ($property in $properties) {
                Assert-AsciiValues -Node $property.Value -PathLabel "$PathLabel.$($property.Name)"
            }
            return
        }
    }

    if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
        $index = 0
        foreach ($item in $Node) {
            Assert-AsciiValues -Node $item -PathLabel "$PathLabel[$index]"
            $index++
        }
    }
}

$state = Get-Content -LiteralPath $StatePath -Encoding utf8 -Raw | ConvertFrom-Json
Assert-AsciiValues -Node $state -PathLabel 'state'

Write-Host "Agent state ASCII check passed: $StatePath"
