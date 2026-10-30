@echo off
rem Install this plugin into the running DSH Desktop profile.
rem
rem The CLI defaults to DSH_HOME=%USERPROFILE%\.dsh, but DSH Desktop keeps its
rem profile under %APPDATA%\dsh-desktop\harness - without that variable the
rem plugin lands in a profile the app never reads.
rem
rem Pass -y to skip the pause (used by scripted runs).
setlocal
set "DSH_HOME=%APPDATA%\dsh-desktop\harness"
set "PLUGIN_DIR=%~dp0.."
for %%I in ("%PLUGIN_DIR%") do set "PLUGIN_DIR=%%~fI"

rem DSH Desktop builds its profile with pnpm 10. A globally installed pnpm 11
rem refuses to touch that node_modules (ERR_PNPM_UNEXPECTED_STORE), so prefer
rem the pnpm shim the desktop ships over whatever is first on PATH.
if exist "%DSH_HOME%\.desktop-bin\pnpm.cmd" set "PATH=%DSH_HOME%\.desktop-bin;%PATH%"

echo DSH_HOME=%DSH_HOME%
echo PLUGIN_DIR=%PLUGIN_DIR%
call dsh plugin --profile web add "%PLUGIN_DIR%"
echo.

findstr /c:"dsh-plugin-custom-bg" "%DSH_HOME%\profiles\web\package.json" >nul 2>&1
if errorlevel 1 (
  echo Install failed: the profile does not list dsh-plugin-custom-bg.
  echo Run "dsh plugin --profile web add \"%PLUGIN_DIR%\"" by hand and read its output.
  if /i not "%~1"=="-y" pause
  exit /b 1
)

echo Installed into %DSH_HOME%\profiles\web
echo Switch to the DSH Desktop window and press Ctrl+R to load it.
echo DSH Desktop rebuilds its profile from managed generations on every launch,
echo so run this script again after restarting the app.
echo.
if /i not "%~1"=="-y" pause
exit /b 0
