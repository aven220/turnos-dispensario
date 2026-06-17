@echo off
chcp 65001 >nul
title Turnos Dispensario - Instalacion

cd /d "%~dp0..\.."

echo ============================================
echo   INSTALACION - Turnos Dispensario
echo   Base de datos LOCAL gratuita
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado.
  echo Descarguelo de https://nodejs.org/ ^(version LTS 20 o 22^)
  pause
  exit /b 1
)

echo [1/6] Instalando dependencias npm...
call npm install
if errorlevel 1 goto :error

if not exist "backend\.env" (
  echo [2/6] Creando backend\.env ...
  copy /Y "deploy\windows\.env.example" "backend\.env"
) else (
  echo [2/6] backend\.env ya existe, no se sobrescribe.
)

set USE_DOCKER=0
where docker >nul 2>&1
if not errorlevel 1 (
  set USE_DOCKER=1
  echo [3/6] Docker detectado. Iniciando PostgreSQL local ^(puerto 5544^)...
  docker compose up -d --wait
  if errorlevel 1 (
    docker compose up -d
    set USE_DOCKER=1
    echo [4/6] Esperando que PostgreSQL este listo...
    timeout /t 12 /nobreak >nul
  ) else (
    set USE_DOCKER=1
    echo [4/6] PostgreSQL listo.
  )
)

if "%USE_DOCKER%"=="0" (
  echo [3/6] Sin Docker. Usando PostgreSQL instalado en Windows.
  echo.
  echo Si aun no lo instalo, siga los pasos del README.md seccion:
  echo "PostgreSQL en Windows ^(sin Docker^)"
  echo.
  echo DATABASE_URL actual en backend\.env:
  type backend\.env | findstr DATABASE_URL
  echo.
  pause
)

echo [5/6] Aplicando migraciones...
call npm run db:deploy
if errorlevel 1 goto :db_error

echo [6/6] Cargando datos iniciales ^(usuarios^)...
call npm run db:seed
if errorlevel 1 goto :error

echo.
echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo Base de datos: LOCAL ^(gratis, sin suscripciones^)
echo Aplicacion:    puerto 8741
if "%USE_DOCKER%"=="1" echo PostgreSQL:    127.0.0.1:5544 ^(Docker^)
echo.
echo Para iniciar: deploy\windows\2-iniciar.bat
echo.
pause
exit /b 0

:db_error
echo.
echo [ERROR] No se pudo conectar a la base de datos.
echo.
echo Soluciones:
echo   1. Instale Docker Desktop y vuelva a ejecutar este script, O
echo   2. Instale PostgreSQL en Windows ^(ver README.md^) y verifique DATABASE_URL
echo.
echo NOTA: XAMPP no sirve para este proyecto ^(usa MySQL, nosotros usamos PostgreSQL^).
pause
exit /b 1

:error
echo.
echo [ERROR] La instalacion fallo. Revise los mensajes anteriores.
pause
exit /b 1
