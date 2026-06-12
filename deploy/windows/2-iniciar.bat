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
  docker compose ps 2>nul | findstr /I "running" >nul 2>&1
  if errorlevel 1 (
    echo Iniciando PostgreSQL local...
    docker compose up -d
    timeout /t 8 /nobreak >nul
  )
)

set NODE_ENV=production

echo.
echo ============================================
echo   Turnos Dispensario en ejecucion
echo ============================================
echo   Base de datos: LOCAL ^(gratis^)
echo   En este equipo:  http://localhost:8741
echo   Pantalla TV:     http://localhost:8741/tv
echo   Admin:           http://localhost:8741/admin
echo.
echo   Otros PCs en la red: http://SU-IP:8741/tv
echo.
echo   Ctrl+C para detener la aplicacion.
echo ============================================
echo.

call npm run start:prod

pause
