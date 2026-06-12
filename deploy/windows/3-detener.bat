@echo off
chcp 65001 >nul
title Turnos Dispensario - Detener

cd /d "%~dp0..\.."

echo Deteniendo solo la base de datos de Turnos Dispensario...
docker compose down

echo.
echo La base de datos se detuvo. Las demas aplicaciones no se ven afectadas.
echo Para volver a iniciar: deploy\windows\2-iniciar.bat
echo.
pause
