param([string]$InventoryPath = 'automation/output/past-exams-batch/inventory.private.json')
$ErrorActionPreference = 'Stop'
$inventory = Get-Content -LiteralPath $InventoryPath -Raw -Encoding utf8 | ConvertFrom-Json
$outputRoot = [IO.Path]::GetFullPath((Join-Path (Get-Location) 'automation/output/past-exams-batch'))
$word = $null
$converted = @()
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  foreach ($item in $inventory.files | Where-Object { $_.needsOfficeRendering }) {
    $role = if ($item.kind -eq [string]::Concat([char]0x8A66,[char]0x5377)) { 'paper' } else { 'key' }
    $folder = [IO.Path]::GetFullPath((Join-Path $outputRoot $item.paperId))
    if (-not $folder.StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Output outside workspace' }
    [IO.Directory]::CreateDirectory($folder) | Out-Null
    $target = Join-Path $folder ($role + '.office.pdf')
    $sourcePath = [IO.Path]::GetFullPath($item.absolutePath)
    $before = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($before -ne $item.sha256) { throw 'Source hash mismatch' }
    $document = $null
    try {
      $document = $word.Documents.Open($sourcePath, $false, $true)
      $document.ExportAsFixedFormat($target, 17)
    } finally {
      if ($null -ne $document) { $document.Close(0); [Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null }
    }
    if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $before) { throw 'Source modified' }
    $converted += @{ paperId=$item.paperId; role=$role; source=$sourcePath; output=$target; sourceSha256=$before; outputSha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
} finally {
  if ($null -ne $word) { $word.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
}
$json = $converted | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $outputRoot 'office-conversions.private.json'), $json, [Text.UTF8Encoding]::new($false))
Write-Output ('Converted office files: ' + $converted.Count)
