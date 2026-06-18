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
  echo [2/6] Creando backend\.env para servidor...
  if exist "deploy\windows\.env.servidor.example" (
    copy /Y "deploy\windows\.env.servidor.example" "backend\.env"
  ) else (
    copy /Y "deploy\windows\.env.example" "backend\.env"
  )
) else (
  echo [2/6] backend\.env ya existe, no se sobrescribe.
)

set USE_DOCKER=0
where docker >nul 2>&1
if not errorlevel 1 (
  findstr /C:"5544" backend\.env >nul 2>&1
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
)

if "%USE_DOCKER%"=="0" (
  echo [3/6] PostgreSQL nativo ^(puerto 5432, base turnos_dispensario^).
  echo.
  echo Si aun no creo usuario y base en pgAdmin, vea:
  echo   deploy\windows\SERVIDOR-192.168.20.26.md
  echo.
  echo DATABASE_URL actual:
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
if "%USE_DOCKER%"=="1" (
  echo PostgreSQL:    127.0.0.1:5544 ^(Docker^)
) else (
  echo PostgreSQL:    127.0.0.1:5432 ^(nativo, base turnos_dispensario^)
  echo Servidor red:   http://192.168.20.26:8741
)
echo.
echo Para iniciar: deploy\windows\2-iniciar.bat
echo Guia servidor: deploy\windows\SERVIDOR-192.168.20.26.md
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
