@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0arranque-completo.ps1"
exit /b %ERRORLEVEL%
