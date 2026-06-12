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

findstr /C:"PEGUE_AQUI" "backend\.env" >nul 2>&1
if not errorlevel 1 (
  echo [ERROR] Configure DATABASE_URL en backend\.env con su URL de Neon
  echo Vea instrucciones en README.md
  pause
  exit /b 1
)

set NODE_ENV=production

echo.
echo ============================================
echo   Turnos Dispensario en ejecucion
echo ============================================
echo   Base de datos: Neon ^(nube gratuita^)
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
