param([string]$Source = (Join-Path $PSScriptRoot '../.work/originals'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$destination = Join-Path $PSScriptRoot '../site/public/photos'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$pairs = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot '../site/public/pairs.json') | ConvertFrom-Json
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
$parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality),([long]88)
foreach ($pair in $pairs) {
 $allPhotos = @($pair.photos) + @($pair.extraPhotos | ForEach-Object { $_.file })
 foreach ($photo in $allPhotos | Where-Object { $_ }) {
  $original = [System.Drawing.Image]::FromFile((Join-Path $Source $photo))
  try {
   if ($original.PropertyIdList -contains 274) {
    switch ($original.GetPropertyItem(274).Value[0]) {
     3 { $original.RotateFlip(2) }
     6 { $original.RotateFlip(1) }
     8 { $original.RotateFlip(3) }
    }
   }
   $maxSize = if ($photo -eq $pair.photos[0]) { 3000.0 } else { 1400.0 }
   $scale = [math]::Min(1.0, $maxSize / [math]::Max($original.Width,$original.Height))
   $resized = New-Object System.Drawing.Bitmap ([int]($original.Width*$scale)),([int]($original.Height*$scale))
   $graphics = [System.Drawing.Graphics]::FromImage($resized)
   try {
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($original,0,0,$resized.Width,$resized.Height)
    $resized.Save((Join-Path $destination $photo),$encoder,$parameters)
   } finally { $graphics.Dispose(); $resized.Dispose() }
  } finally { $original.Dispose() }
 }
}
$parameters.Dispose()
Write-Output 'Prepared oriented, web-sized photos without original metadata; mirror views retain extra resolution for face crops.'
