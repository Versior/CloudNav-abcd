Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..\public\branding\hapora'
$root = [System.IO.Path]::GetFullPath($root)
New-Item -ItemType Directory -Force -Path $root | Out-Null

function Draw-HaporaMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [double]$X,
    [double]$Y,
    [double]$Scale,
    [bool]$Dark
  )

  $coral = [System.Drawing.Color]::FromArgb(255, 255, 130, 111)
  $violet = [System.Drawing.Color]::FromArgb(255, 128, 107, 255)
  if ($Dark) {
    $coral = [System.Drawing.Color]::FromArgb(255, 255, 153, 136)
    $violet = [System.Drawing.Color]::FromArgb(255, 166, 154, 255)
  }
  $ink = if ($Dark) { [System.Drawing.Color]::FromArgb(255, 247, 244, 238) } else { [System.Drawing.Color]::FromArgb(255, 20, 23, 34) }

  $oldTransform = $Graphics.Transform
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate([float]$X, [float]$Y)
  $matrix.Scale([float]$Scale, [float]$Scale)
  $Graphics.Transform = $matrix

  $pathA = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pathA.AddLine(48, 26, 48, 144)
  $pathA.AddBezier(48, 166, 66, 184, 84, 184, 108, 184)
  $pathA.AddBezier(130, 184, 148, 166, 148, 144, 148, 122)
  $pathA.AddBezier(148, 100, 166, 82, 188, 82, 212, 82)
  $penA = New-Object System.Drawing.Pen($coral, 22)
  $penA.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penA.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penA.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Graphics.DrawPath($penA, $pathA)

  $pathB = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pathB.AddLine(216, 26, 216, 144)
  $pathB.AddBezier(216, 166, 198, 184, 180, 184, 156, 184)
  $pathB.AddBezier(134, 184, 116, 166, 116, 144, 116, 122)
  $pathB.AddBezier(116, 100, 98, 82, 76, 82, 52, 82)
  $penB = New-Object System.Drawing.Pen($violet, 22)
  $penB.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penB.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penB.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Graphics.DrawPath($penB, $pathB)

  $smile = New-Object System.Drawing.Drawing2D.GraphicsPath
  $smile.AddBezier(82, 126, 100, 152, 140, 152, 158, 126)
  $smilePen = New-Object System.Drawing.Pen($ink, 14)
  $smilePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $smilePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Graphics.DrawPath($smilePen, $smile)

  $Graphics.FillEllipse((New-Object System.Drawing.SolidBrush($coral)), 74, 90, 16, 16)
  $Graphics.FillEllipse((New-Object System.Drawing.SolidBrush($violet)), 150, 90, 16, 16)

  $Graphics.Transform = $oldTransform
  $pathA.Dispose(); $pathB.Dispose(); $smile.Dispose()
  $penA.Dispose(); $penB.Dispose(); $smilePen.Dispose()
}

function Draw-Wordmark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [bool]$Dark
  )

  $color = if ($Dark) { [System.Drawing.Color]::FromArgb(255, 247, 244, 238) } else { [System.Drawing.Color]::FromArgb(255, 20, 23, 34) }
  $font = New-Object System.Drawing.Font('Segoe UI', 154, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush($color)
  $x = [float]380
  foreach ($char in 'HAPORA'.ToCharArray()) {
    $Graphics.DrawString($char, $font, $brush, $x, 90)
    $size = $Graphics.MeasureString($char, $font)
    $x += $size.Width + 14
  }
  $font.Dispose(); $brush.Dispose()
}

function New-HaporaLockup {
  param(
    [string]$Path,
    [bool]$Dark
  )
  $bitmap = New-Object System.Drawing.Bitmap(1600, 400, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-HaporaMark -Graphics $graphics -X 56 -Y 56 -Scale 1 -Dark $Dark
  Draw-Wordmark -Graphics $graphics -Dark $Dark
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

function New-HaporaMark {
  param([string]$Path)
  $bitmap = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::Transparent)
  Draw-HaporaMark -Graphics $graphics -X 96 -Y 96 -Scale 1.25 -Dark $false
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

New-HaporaLockup -Path (Join-Path $root 'hapora-logo-light.png') -Dark $false
New-HaporaLockup -Path (Join-Path $root 'hapora-logo-dark.png') -Dark $true
New-HaporaMark -Path (Join-Path $root 'hapora-mark.png')
Write-Output "Generated HAPORA logo assets in $root"
