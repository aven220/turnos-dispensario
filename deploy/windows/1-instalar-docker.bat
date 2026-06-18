@echo off
chcp 65001 >nul
title Turnos Dispensario - Instalacion Docker

cd /d "%~dp0..\.."

echo ============================================
echo   INSTALACION DOCKER - Turnos Dispensario
echo   Servidor 192.168.20.26
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no encontrado. Instale Docker Desktop.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no esta corriendo. Abra Docker Desktop y espere a que inicie.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo Creando backend\.env para Docker...
  copy /Y "deploy\windows\.env.servidor-docker.example" "backend\.env"
)

echo [1/4] Construyendo imagen de la aplicacion...
docker compose build
if errorlevel 1 goto :error

echo [2/4] Iniciando PostgreSQL en Docker ^(puerto 5544^)...
docker compose up -d postgres
if errorlevel 1 goto :error

echo [3/4] Esperando base de datos...
timeout /t 15 /nobreak >nul
docker compose ps

echo [4/4] Migraciones, datos iniciales y arranque...
set SEED_ON_START=true
docker compose up -d app
if errorlevel 1 goto :error

echo.
echo [IMPORTANTE] Para acceso desde la red ejecute como Administrador:
echo   deploy\windows\7-abrir-firewall.bat

echo.
echo Esperando que la aplicacion arranque...
timeout /t 20 /nobreak >nul

echo.
echo ============================================
echo   INSTALACION DOCKER COMPLETADA
echo ============================================
echo.
echo Contenedores:
docker compose ps
echo.
echo Salud:  http://localhost:8741/api/health
echo Red:    http://192.168.20.26:8741
echo TV:     http://192.168.20.26:8741/tv
echo.
echo Iniciar despues: deploy\windows\2-iniciar-docker.bat
echo   PowerShell:    .\deploy\windows\2-iniciar-docker.ps1
echo Detener:         deploy\windows\3-detener-docker.bat
echo   PowerShell:    .\deploy\windows\3-detener-docker.ps1
echo Logs:            docker compose logs -f app
echo Recrear usuarios: deploy\windows\8-recrear-usuarios.bat
echo Diagnostico:      deploy\windows\9-diagnostico.bat
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] La instalacion Docker fallo.
echo Revise: docker compose logs
pause
exit /b 1
