@echo off
chcp 65001 >nul
title Turnos Dispensario - Docker

cd /d "%~dp0..\.."

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no encontrado.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Abra Docker Desktop primero.
  pause
  exit /b 1
)

echo Iniciando Turnos Dispensario con Docker...
set SEED_ON_START=false
docker compose up -d --build

echo.
echo ============================================
echo   Turnos Dispensario ^(Docker^)
echo ============================================
echo   Login:  http://192.168.20.26:8741
echo   TV:     http://192.168.20.26:8741/tv
echo   Salud:  http://192.168.20.26:8741/api/health
echo.
echo   Ver logs: docker compose logs -f app
echo   Detener:  deploy\windows\3-detener-docker.bat
echo ============================================
echo.

docker compose ps
pause
