param([string]$Root)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$entries = Get-Content -LiteralPath (Join-Path $Root 'catalog/image-manifest.json') -Raw -Encoding utf8 | ConvertFrom-Json
$converted = 0
foreach ($entry in $entries) {
    if (-not $entry.conversion) { continue }
    $target = Join-Path $Root ('web-images/' + $entry.web_file)
    if (Test-Path -LiteralPath $target) { continue }
    $image = $null; $bitmap = $null; $graphics = $null
    try {
        $image = [System.Drawing.Image]::FromFile((Join-Path $Root ('original-images/' + $entry.original_file)))
        $scale = [Math]::Min(3.0, 2400.0 / [Math]::Max($image.Width,$image.Height))
        $bitmap = [System.Drawing.Bitmap]::new([Math]::Max(12,[int][Math]::Ceiling($image.Width*$scale)),[Math]::Max(12,[int][Math]::Ceiling($image.Height*$scale)))
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.DrawImage($image,0,0,$bitmap.Width,$bitmap.Height)
        $bitmap.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
        $converted++
    } finally { if($graphics){$graphics.Dispose()};if($bitmap){$bitmap.Dispose()};if($image){$image.Dispose()} }
}
Write-Output ("Converted: " + $converted)
