@echo off
chcp 65001 >nul
title Turnos Dispensario - Detener Docker

cd /d "%~dp0..\.."

echo Deteniendo contenedores Turnos Dispensario...
docker compose down

echo.
echo Contenedores detenidos. Los datos de PostgreSQL se conservan en el volumen Docker.
echo Para volver a iniciar: deploy\windows\2-iniciar-docker.bat
echo.
pause
