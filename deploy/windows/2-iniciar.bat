@echo off
chcp 65001 >nul
title Turnos Dispensario

cd /d "%~dp0..\.."

if not exist "backend\.env" (
  echo [ERROR] No existe backend\.env
  echo Ejecute primero: deploy\windows\1-instalar.bat
  pause
  exit /b 1
)

where docker >nul 2>&1
if not errorlevel 1 (
  docker info >nul 2>&1
  if not errorlevel 1 (
    docker compose ps --format "{{.Name}}" 2>nul | findstr /I "turnos-app" >nul 2>&1
    if not errorlevel 1 (
      echo [INFO] La app ya corre en Docker. Use 2-iniciar-docker.bat o docker compose up -d
      goto :after_docker
    )
    echo Iniciando PostgreSQL Docker...
    docker compose up -d postgres --wait
    if errorlevel 1 (
      docker compose up -d postgres
      timeout /t 10 /nobreak >nul
    )
  )
)
:after_docker

findstr /C:"5432" backend\.env >nul 2>&1
if not errorlevel 1 (
  findstr /C:"5544" backend\.env >nul 2>&1
  if errorlevel 1 (
    echo.
    echo [AVISO] backend\.env apunta al puerto 5432 ^(PostgreSQL nativo^).
    echo Si usa PostgreSQL en Docker, ejecute:
    echo   deploy\windows\10-corregir-database.bat
    echo.
  )
)

set NODE_ENV=production

for /f "usebackq tokens=1,* delims==" %%a in (`findstr /B "PORT=" backend\.env 2^>nul`) do set APP_PORT=%%b
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /B "PUBLIC_SERVER_IP=" backend\.env 2^>nul`) do set SERVER_IP=%%b
set APP_PORT=%APP_PORT:"=%
set SERVER_IP=%SERVER_IP:"=%
if not defined APP_PORT set APP_PORT=8741
if not defined SERVER_IP set SERVER_IP=SU-IP

echo.
echo Compilando aplicacion...
call npm run build
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Turnos Dispensario en ejecucion
echo ============================================
echo   Base de datos: LOCAL
echo   Login:         http://localhost:%APP_PORT%
if not "%SERVER_IP%"=="SU-IP" (
  echo   Red ^(IP servidor^): http://%SERVER_IP%:%APP_PORT%
)
echo   Admin:         http://localhost:%APP_PORT%/admin
echo   Filtro:        http://localhost:%APP_PORT%/filtro
echo   Ventanilla:    http://localhost:%APP_PORT%/ventanilla
echo.
echo   Pantalla TV:
if not "%SERVER_IP%"=="SU-IP" (
  echo   http://%SERVER_IP%:%APP_PORT%/tv
) else (
  echo   http://localhost:%APP_PORT%/tv
)
echo.
echo   Salud:         http://localhost:%APP_PORT%/api/health
echo   Ctrl+C para detener.
echo ============================================
echo.

call npm run start:server

pause
