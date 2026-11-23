# Regenerates the app logo PNGs in ../assets. Windows PowerShell (System.Drawing).
# Mark: a QR "finder" square (white ring + lime core) on electric violet.
Add-Type -AssemblyName System.Drawing
$assets = Join-Path $PSScriptRoot '..\assets'
$violet = [System.Drawing.ColorTranslator]::FromHtml('#7C5CFF')
$lime   = [System.Drawing.ColorTranslator]::FromHtml('#C6FF3D')
$white  = [System.Drawing.Color]::White

function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Draws the mark centred in a canvas of $size, occupying $scale of its width.
function DrawMark($g, [int]$size, [float]$scale, $ringColor, $coreColor) {
  $m = $size * $scale
  $o = ($size - $m) / 2
  $stroke = $m * 0.2
  $outer = RoundRect $o $o $m $m ($m * 0.3)
  $inset = $o + $stroke
  $innerSide = $m - 2 * $stroke
  $hole = RoundRect $inset $inset $innerSide $innerSide ($innerSide * 0.22)
  $ring = New-Object System.Drawing.Region($outer)
  $ring.Exclude($hole)
  $g.FillRegion((New-Object System.Drawing.SolidBrush($ringColor)), $ring)
  $core = $m * 0.34
  $c = ($size - $core) / 2
  $g.FillPath((New-Object System.Drawing.SolidBrush($coreColor)), (RoundRect $c $c $core $core ($core * 0.3)))
}

function NewCanvas([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  return @($bmp, $g)
}

function Save($pair, [string]$name) {
  $pair[1].Dispose()
  $pair[0].Save((Join-Path $assets $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $pair[0].Dispose()
}

# iOS / store icon: full-bleed violet square (the OS applies its own mask).
$c = NewCanvas 1024; $c[1].Clear($violet); DrawMark $c[1] 1024 0.5 $white $lime; Save $c 'icon.png'
# Android adaptive: background layer + transparent foreground inside the 66% safe zone.
$c = NewCanvas 512; $c[1].Clear($violet); Save $c 'android-icon-background.png'
$c = NewCanvas 512; DrawMark $c[1] 512 0.36 $white $lime; Save $c 'android-icon-foreground.png'
$c = NewCanvas 432; DrawMark $c[1] 432 0.36 $white $white; Save $c 'android-icon-monochrome.png'
# Splash and favicon.
$c = NewCanvas 1024; DrawMark $c[1] 1024 0.6 $violet $lime; Save $c 'splash-icon.png'
$c = NewCanvas 48; $p = RoundRect 0 0 48 48 12; $c[1].FillPath((New-Object System.Drawing.SolidBrush($violet)), $p); DrawMark $c[1] 48 0.6 $white $lime; Save $c 'favicon.png'
Write-Output 'icons written'
