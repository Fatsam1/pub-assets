$chromeCfT = "E:\work\chrome-for-testing\chrome-win64\chrome.exe"
$extPath = "E:\work\projects\priv8agent-extension"
$profile = "$env:TEMP\priv8agent-profile"

if (!(Test-Path $profile)) { New-Item -ItemType Directory -Path $profile | Out-Null }

Write-Host "Launching Priv8Agent in Chrome for Testing..."
Start-Process -FilePath $chromeCfT -ArgumentList @(
    "--user-data-dir=`"$profile`"",
    "--load-extension=`"$extPath`"",
    "--no-first-run",
    "--disable-default-apps",
    "--no-sandbox"
)
Write-Host "Chrome for Testing launched with Priv8Agent extension."
Write-Host "Extension ID: cahkkifpknlgjpmbgmojnjggfmlgfpgm"
