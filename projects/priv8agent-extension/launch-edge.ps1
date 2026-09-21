# Launch Edge with Priv8Agent extension loaded
$extPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$profile = "$env:TEMP\edge-priv8-profile-new"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (-not (Test-Path $profile)) { New-Item -ItemType Directory -Path $profile -Force | Out-Null }

Write-Host "Launching Edge with Priv8Agent extension..."
Write-Host "Extension: $extPath"
Write-Host "Profile: $profile"

Start-Process -FilePath $edgePath -ArgumentList `
    "--user-data-dir=`"$profile`"",
    "--load-extension=`"$extPath`"",
    "--remote-debugging-port=9224",
    "--no-first-run",
    "--no-default-browser-check",
    "https://app.privatehash.online"

Write-Host "Edge launched on debug port 9224."
Write-Host "Open sidepanel: navigate to chrome-extension://bamldldfaegddgbodmjipedgcedcpani/sidepanel.html"
