@echo off
setlocal

set CHROME_CFT=E:\work\chrome-for-testing\chrome-win64\chrome.exe
set EXT_PATH=E:\work\projects\priv8agent-extension
set PROFILE=%TEMP%\priv8agent-profile

if not exist "%PROFILE%" mkdir "%PROFILE%"

echo ============================================
echo  Priv8Agent - Chrome for Testing Launch
echo ============================================
echo Extension: %EXT_PATH%
echo Profile:   %PROFILE%
echo.

"%CHROME_CFT%" ^
  --user-data-dir="%PROFILE%" ^
  --load-extension="%EXT_PATH%" ^
  --no-first-run ^
  --disable-default-apps ^
  --no-sandbox

endlocal
