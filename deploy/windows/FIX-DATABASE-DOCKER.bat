@echo off
chcp 65001 >nul
title FIX - Base de datos Docker 5544

cd /d "%~dp0..\.."

echo ============================================
echo   CORRECCION AUTOMATICA - PostgreSQL Docker
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
  echo [ERROR] Abra Docker Desktop y espere a que inicie.
  pause
  exit /b 1
)

echo [1/5] Configurando backend\.env para puerto 5544...
copy /Y "deploy\windows\.env.servidor-docker.example" "backend\.env"
echo.

echo [2/5] Iniciando PostgreSQL Docker...
docker compose up -d postgres
echo Esperando PostgreSQL...
timeout /t 12 /nobreak >nul
docker compose ps postgres
echo.

echo [3/5] DATABASE_URL configurada:
findstr DATABASE_URL backend\.env
echo.

echo [4/5] Aplicando migraciones...
call npm run db:deploy
if errorlevel 1 (
  echo.
  echo [ERROR] Migraciones fallaron.
  echo Verifique: docker compose logs postgres
  pause
  exit /b 1
)

echo.
echo [5/5] Creando usuarios...
call npm run db:seed
if errorlevel 1 (
  echo [ERROR] Seed fallo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   LISTO
echo ============================================
echo.
echo Login:  admin / CencoicAdmin2026
echo.
echo Iniciar aplicacion con Docker:
echo   deploy\windows\2-iniciar-docker.bat
echo.
echo O solo Node ^(sin contenedor app^):
echo   deploy\windows\2-iniciar.bat
echo.
pause
