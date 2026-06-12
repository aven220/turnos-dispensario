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

echo Verificando PostgreSQL...
docker compose ps | findstr /I "running" >nul 2>&1
if errorlevel 1 (
  echo Iniciando PostgreSQL...
  docker compose up -d
  timeout /t 8 /nobreak >nul
)

set NODE_ENV=production

echo.
echo ============================================
echo   Turnos Dispensario en ejecucion
echo ============================================
echo   En este equipo:  http://localhost:8741
echo   Pantalla TV:     http://localhost:8741/tv
echo   Admin:           http://localhost:8741/admin
echo.
echo   Para otros PCs de la red use la IP de este servidor:
echo   http://SU-IP:8741/tv
echo.
echo   Presione Ctrl+C para detener.
echo ============================================
echo.

call npm run start:prod

pause
