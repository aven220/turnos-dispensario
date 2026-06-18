@echo off
chcp 65001 >nul
title Configurar servidor Docker 192.168.20.26

cd /d "%~dp0..\.."

echo ============================================
echo   CONFIGURACION SERVIDOR + DOCKER
echo   IP: 192.168.20.26
echo   App: puerto 8741
echo   PostgreSQL Docker: 127.0.0.1:5544
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no esta instalado o no esta en el PATH.
  echo Instale Docker Desktop y vuelva a ejecutar este script.
  pause
  exit /b 1
)

if exist "backend\.env" (
  echo Ya existe backend\.env
  choice /C SN /M "Desea reemplazarlo con la configuracion Docker"
  if errorlevel 2 (
    echo Cancelado.
    pause
    exit /b 0
  )
)

copy /Y "deploy\windows\.env.servidor-docker.example" "backend\.env"

echo.
echo [OK] Configuracion lista.
echo.
echo SIGUIENTE:
echo   deploy\windows\1-instalar-docker.bat
echo   deploy\windows\2-iniciar-docker.bat
echo.
echo URLs:
echo   http://192.168.20.26:8741
echo   http://192.168.20.26:8741/tv
echo.
pause
