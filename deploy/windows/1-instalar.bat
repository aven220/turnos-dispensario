@echo off
chcp 65001 >nul
title Turnos Dispensario - Instalacion

cd /d "%~dp0..\.."

echo ============================================
echo   INSTALACION - Turnos Dispensario
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado.
  echo Descarguelo de https://nodejs.org/ ^(version LTS 20 o 22^)
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no esta instalado o no esta en ejecucion.
  echo Instale Docker Desktop para Windows y vuelva a ejecutar este script.
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

echo [3/6] Iniciando base de datos PostgreSQL ^(puerto local 5544^)...
docker compose up -d
if errorlevel 1 goto :error

echo [4/6] Esperando que PostgreSQL este listo...
timeout /t 12 /nobreak >nul

echo [5/6] Aplicando migraciones...
call npm run db:deploy
if errorlevel 1 goto :error

echo [6/6] Cargando datos iniciales ^(usuarios de prueba^)...
call npm run db:seed
if errorlevel 1 goto :error

echo.
echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo Puertos usados ^(solo locales, no afectan otras apps^):
echo   - Aplicacion: 8741
echo   - PostgreSQL: 127.0.0.1:5544
echo.
echo Para iniciar ejecute: deploy\windows\2-iniciar.bat
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] La instalacion fallo. Revise los mensajes anteriores.
pause
exit /b 1
