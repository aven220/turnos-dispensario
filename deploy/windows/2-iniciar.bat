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
  echo Iniciando PostgreSQL local...
  docker compose up -d --wait
  if errorlevel 1 (
    echo [AVISO] No se pudo verificar Docker. Continuando...
    docker compose up -d
    timeout /t 10 /nobreak >nul
  )
)

set NODE_ENV=production

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
echo   Login:         http://localhost:8741
echo   Admin:         http://localhost:8741/admin
echo   Filtro:        http://localhost:8741/filtro
echo   Ventanilla:    http://localhost:8741/ventanilla
echo.
echo   Pantalla TV ^(solo en el navegador de la TV^):
echo   http://localhost:8741/tv
echo   Red local:     http://SU-IP:8741/tv
echo.
echo   Salud:         http://localhost:8741/api/health
echo   Ctrl+C para detener.
echo ============================================
echo.

call npm run start:server

pause
