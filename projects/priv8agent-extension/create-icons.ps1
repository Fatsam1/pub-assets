# Create Priv8Agent icons using .NET
Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param([int]$Size, [string]$OutPath)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Background gradient (purple)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($Size, $Size),
        [System.Drawing.Color]::FromArgb(124, 58, 237),
        [System.Drawing.Color]::FromArgb(79, 70, 229)
    )
    $g.FillEllipse($bgBrush, 0, 0, $Size-1, $Size-1)

    # Snake emoji approximation — just draw "P8" text
    $fontSize = $Size * 0.45
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("P8", $font, $brush, [System.Drawing.RectangleF]::new(0, 0, $Size, $Size), $sf)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $OutPath ($Size x $Size)"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconsDir = Join-Path $scriptDir "icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

Create-Icon -Size 16 -OutPath (Join-Path $iconsDir "icon16.png")
Create-Icon -Size 32 -OutPath (Join-Path $iconsDir "icon32.png")
Create-Icon -Size 48 -OutPath (Join-Path $iconsDir "icon48.png")
Create-Icon -Size 128 -OutPath (Join-Path $iconsDir "icon128.png")

Write-Host "All icons created!"
