@echo off
setlocal
set "ROOT=%~dp0"
set "BRIDGE=%ROOT%tools\classic-chat-bridge"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or newer is required.
  echo Install Node.js, reopen this window, and run this file again.
  pause
  exit /b 1
)
for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)"
if errorlevel 1 (
  echo Found Node.js %NODE_VERSION%, but version 22.12 or newer is required.
  pause
  exit /b 1
)

if not exist "%BRIDGE%\node_modules\@siwc\local\package.json" (
  where git >nul 2>nul
  if errorlevel 1 (
    echo Git is required for the first-time DevKit setup.
    pause
    exit /b 1
  )
  echo First-time setup: downloading the pinned OpenAI DevKit and dependencies.
  echo This requires internet access. No credentials are requested by setup.
  pushd "%BRIDGE%"
  node setup.mjs
  if errorlevel 1 (
    echo.
    echo Setup failed. Read the error above, fix the issue, and run this file again.
    popd
    pause
    exit /b 1
  )
  popd
)

echo.
echo Starting Classic Chat local bridge.
echo When the server reports that it is listening, open:
echo http://127.0.0.1:17879/
echo.
echo Keep this window open while using Classic Chat.
echo Press Ctrl+C here to stop the local service.
echo.
pushd "%BRIDGE%"
call npm start
set "RESULT=%ERRORLEVEL%"
popd
if not "%RESULT%"=="0" (
  echo.
  echo Classic Chat exited with code %RESULT%.
  pause
)
exit /b %RESULT%
