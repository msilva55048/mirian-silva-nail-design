@echo off
setlocal
cd /d "%~dp0.."
if not exist "worker\logs" mkdir "worker\logs"
echo [%date% %time%] [launcher] iniciando worker >> "worker\logs\worker.log"
"C:\Program Files\nodejs\node.exe" --env-file=worker/.env worker/whatsapp-web.mjs >> "worker\logs\worker.log" 2>&1
set "exitCode=%ERRORLEVEL%"
echo [%date% %time%] [launcher] worker encerrado com codigo %exitCode% >> "worker\logs\worker.log"
exit /b %exitCode%
