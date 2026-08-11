@echo off
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

if not defined TEMP (
  echo [ERROR] The system TEMP directory is unavailable.
  exit /b 1
)

set "RUNTIME_DIR=%TEMP%\PersonalWorkbenchLocal"
set "DATA_DIR=%RUNTIME_DIR%\workspace"
set "PID_FILE=%RUNTIME_DIR%\controller.pid"
set "PASSWORD_FILE=%RUNTIME_DIR%\password.txt"
set "APP_URL=http://127.0.0.1:5173"
set "API_PORT=3000"
set "WEB_PORT=5173"

set "PW_LOCAL_PROJECT=%PROJECT_ROOT%"
set "PW_LOCAL_SCRIPT=%~f0"
set "PW_LOCAL_RUNTIME=%RUNTIME_DIR%"
set "PW_LOCAL_DATA=%DATA_DIR%"
set "PW_LOCAL_PID_FILE=%PID_FILE%"
set "PW_LOCAL_PASSWORD_FILE=%PASSWORD_FILE%"

if /i "%~1"=="serve" goto serve
if /i "%~1"=="start" goto cli_start
if /i "%~1"=="stop" goto cli_stop
if /i "%~1"=="restart" goto cli_restart
if /i "%~1"=="status" goto cli_status
if not "%~1"=="" goto usage

:menu
cls
echo ==================================================
echo       Personal Workbench - Temporary Local Mode
echo ==================================================
echo.
echo   1. Start and open browser
echo   2. Stop and remove temporary data
echo   3. Restart
echo   4. Check process and port status
echo   0. Exit menu
echo.
choice /c 12340 /n /m "Select [1/2/3/4/0]: "
if errorlevel 5 exit /b 0
if errorlevel 4 goto menu_status
if errorlevel 3 goto menu_restart
if errorlevel 2 goto menu_stop
if errorlevel 1 goto menu_start

:menu_start
call :start_workbench
echo.
pause
goto menu

:menu_stop
call :stop_workbench
echo.
pause
goto menu

:menu_restart
call :stop_workbench
call :start_workbench
echo.
pause
goto menu

:menu_status
call :show_status
echo.
pause
goto menu

:cli_start
call :start_workbench
exit /b %errorlevel%

:cli_stop
call :stop_workbench
exit /b %errorlevel%

:cli_restart
call :stop_workbench
call :start_workbench
exit /b %errorlevel%

:cli_status
call :show_status
exit /b %errorlevel%

:usage
echo Usage: %~nx0 [start^|stop^|restart^|status]
echo Run without arguments to open the menu.
exit /b 2

:ensure_runtime
if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%" >nul 2>&1
if not exist "%RUNTIME_DIR%" (
  echo [ERROR] Cannot create temporary runtime directory: %RUNTIME_DIR%
  exit /b 1
)
exit /b 0

:controller_running
powershell -NoLogo -NoProfile -Command ^
  "$path=$env:PW_LOCAL_PID_FILE; if(-not (Test-Path -LiteralPath $path)){exit 1}; $raw=(Get-Content -Raw -LiteralPath $path).Trim(); $id=0; if(-not [int]::TryParse($raw,[ref]$id)){exit 1}; if(Get-Process -Id $id -ErrorAction SilentlyContinue){exit 0}; exit 1"
exit /b %errorlevel%

:ports_available
powershell -NoLogo -NoProfile -Command ^
  "$ports=@(%API_PORT%,%WEB_PORT%); $used=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue ^| Where-Object LocalPort -In $ports); if($used.Count -gt 0){exit 1}; exit 0"
exit /b %errorlevel%

:clear_temporary_data
powershell -NoLogo -NoProfile -Command ^
  "$temp=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\'); $runtime=[IO.Path]::GetFullPath($env:PW_LOCAL_RUNTIME).TrimEnd('\'); $data=[IO.Path]::GetFullPath($env:PW_LOCAL_DATA); $expected=Join-Path $temp 'PersonalWorkbenchLocal'; if(-not $runtime.Equals($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected runtime directory'}; if(-not $data.StartsWith($runtime+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing to clean data outside runtime directory'}; if(Test-Path -LiteralPath $data){Remove-Item -LiteralPath $data -Recurse -Force -ErrorAction Stop}; exit 0"
exit /b %errorlevel%

:start_workbench
echo.
echo [START] Checking the local environment...
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js 22 or newer was not found.
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found.
  exit /b 1
)

call :ensure_runtime
if errorlevel 1 exit /b 1

call :controller_running
if not errorlevel 1 (
  echo [INFO] The workbench is already running.
  call :show_status
  start "" "%APP_URL%"
  exit /b 0
)

if exist "%PID_FILE%" del /q "%PID_FILE%" >nul 2>&1
call :ports_available
if errorlevel 1 (
  echo [ERROR] Port %API_PORT% or %WEB_PORT% is already in use. Startup was cancelled.
  call :show_status
  exit /b 1
)

if not exist "%PROJECT_ROOT%\node_modules" (
  echo [SETUP] Installing dependencies for the first run...
  call npm ci
  if errorlevel 1 (
    echo [ERROR] npm ci failed.
    exit /b 1
  )
)

call :clear_temporary_data
if errorlevel 1 (
  echo [ERROR] Old temporary data could not be cleaned safely.
  exit /b 1
)

for /f "usebackq delims=" %%P in (`powershell -NoLogo -NoProfile -Command "[guid]::NewGuid().ToString('N')"`) do set "LOCAL_PASSWORD=%%P"
if not defined LOCAL_PASSWORD (
  echo [ERROR] A temporary login password could not be generated.
  exit /b 1
)
>"%PASSWORD_FILE%" echo %LOCAL_PASSWORD%

echo [START] Starting the API and Web app in the background...
powershell -NoLogo -NoProfile -Command ^
  "$script=$env:PW_LOCAL_SCRIPT; $arguments='/d /s /c ""'+$script+'" serve"'; $p=Start-Process -FilePath $env:ComSpec -ArgumentList $arguments -WorkingDirectory $env:PW_LOCAL_PROJECT -WindowStyle Minimized -PassThru; Set-Content -LiteralPath $env:PW_LOCAL_PID_FILE -Value $p.Id -Encoding ascii"
if errorlevel 1 (
  echo [ERROR] The background process could not be created.
  del /q "%PASSWORD_FILE%" >nul 2>&1
  exit /b 1
)

powershell -NoLogo -NoProfile -Command ^
  "$deadline=(Get-Date).AddSeconds(60); do { $api=Get-NetTCPConnection -State Listen -LocalPort %API_PORT% -ErrorAction SilentlyContinue; $web=Get-NetTCPConnection -State Listen -LocalPort %WEB_PORT% -ErrorAction SilentlyContinue; if($api -and $web){exit 0}; Start-Sleep -Milliseconds 500 } while((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo [ERROR] Startup timed out. Open the minimized "Personal Workbench Local Server" window for details.
  call :show_status
  exit /b 1
)

echo %LOCAL_PASSWORD%| clip >nul 2>&1
echo.
echo [READY] The workbench is running. The browser will open now.
echo         URL: %APP_URL%
echo         Username: owner
echo         Temporary password: %LOCAL_PASSWORD%
echo         The temporary password has been copied to the clipboard.
echo         To stop: %~nx0 stop
start "" "%APP_URL%"
exit /b 0

:stop_workbench
echo.
echo [STOP] Stopping the workbench started by this script...
call :controller_running
if errorlevel 1 goto stop_without_controller

powershell -NoLogo -NoProfile -Command ^
  "$raw=(Get-Content -Raw -LiteralPath $env:PW_LOCAL_PID_FILE).Trim(); $id=0; if(-not [int]::TryParse($raw,[ref]$id)){exit 1}; $process=Get-Process -Id $id -ErrorAction SilentlyContinue; if($process){$null=& taskkill.exe /PID $id /T /F; exit $LASTEXITCODE}; exit 0"
if errorlevel 1 (
  echo [ERROR] The background process could not be stopped.
  exit /b 1
)
goto stop_cleanup

:stop_without_controller
echo [INFO] No process recorded by this script was found. Other programs will not be stopped.

:stop_cleanup
if exist "%PID_FILE%" del /q "%PID_FILE%" >nul 2>&1
if exist "%PASSWORD_FILE%" del /q "%PASSWORD_FILE%" >nul 2>&1
call :clear_temporary_data
if errorlevel 1 (
  echo [WARNING] The process stopped, but temporary data cleanup failed: %DATA_DIR%
  exit /b 1
)
echo [DONE] The workbench stopped and temporary data was removed.
call :show_status
exit /b 0

:show_status
echo.
echo ---------------- Current status ----------------
powershell -NoLogo -NoProfile -Command ^
  "$pidPath=$env:PW_LOCAL_PID_FILE; $controller=$null; if(Test-Path -LiteralPath $pidPath){$raw=(Get-Content -Raw -LiteralPath $pidPath).Trim(); $id=0; if([int]::TryParse($raw,[ref]$id)){$controller=Get-Process -Id $id -ErrorAction SilentlyContinue}}; if($controller){Write-Host ('Controller: running (PID {0})' -f $controller.Id)}else{Write-Host 'Controller: not running'}; foreach($item in @(@(%API_PORT%,'API'),@(%WEB_PORT%,'Web'))){$port=[int]$item[0]; $label=$item[1]; $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue); if($listeners.Count -eq 0){Write-Host ('{0} port {1}: not listening' -f $label,$port)}else{foreach($listener in $listeners){$name=(Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue).ProcessName; if(-not $name){$name='unknown process'}; Write-Host ('{0} port {1}: listening (PID {2}, {3})' -f $label,$port,$listener.OwningProcess,$name)}}}; if($controller -and (Test-Path -LiteralPath $env:PW_LOCAL_PASSWORD_FILE)){Write-Host ('Login: owner / '+(Get-Content -Raw -LiteralPath $env:PW_LOCAL_PASSWORD_FILE).Trim())}"
echo ------------------------------------------
exit /b 0

:serve
title Personal Workbench Local Server
call :ensure_runtime
if errorlevel 1 exit /b 1
if not exist "%PASSWORD_FILE%" (
  echo [ERROR] The temporary password file does not exist.
  pause
  exit /b 1
)
set /p WORKBENCH_TEST_PASSWORD=<"%PASSWORD_FILE%"
set "WORKBENCH_ROOT=%DATA_DIR%"
set "APP_ORIGIN=%APP_URL%"
set "NODE_ENV=test"
set "DATABASE_IN_MEMORY=true"
echo The workbench is running with an in-memory database.
echo Use the menu or run workbench-local.bat stop to close it.
echo.
call npm run build -w @workspace/client-sdk
if errorlevel 1 (
  echo.
  echo [ERROR] The client SDK build failed.
  pause
  exit /b 1
)
call "%PROJECT_ROOT%\node_modules\.bin\concurrently.cmd" -n api,web -c green,cyan "node_modules\.bin\tsx.cmd apps/api/src/entrypoints/http.ts" "npm run dev -w @workspace/web"
set "SERVER_EXIT=%errorlevel%"
if not "%SERVER_EXIT%"=="0" (
  echo.
  echo [ERROR] The local server exited unexpectedly with code %SERVER_EXIT%.
  pause
)
exit /b %SERVER_EXIT%
