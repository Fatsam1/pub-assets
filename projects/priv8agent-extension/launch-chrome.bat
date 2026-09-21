@echo off
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --load-extension="E:\work\projects\priv8agent-extension" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-default-apps ^
  --flag-switches-begin ^
  --extensions-on-chrome-urls ^
  --flag-switches-end
