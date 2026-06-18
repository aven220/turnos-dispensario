@echo off
chcp 65001 >nul
title Configurar servidor 192.168.20.26

cd /d "%~dp0..\.."

echo ============================================
echo   CONFIGURACION SERVIDOR
echo   IP: 192.168.20.26
echo   Puerto app: 8741
echo   PostgreSQL: 127.0.0.1:5432 ^(base turnos_dispensario^)
echo ============================================
echo.

if exist "backend\.env" (
  echo Ya existe backend\.env
  echo.
  choice /C SN /M "Desea reemplazarlo con la configuracion del servidor"
  if errorlevel 2 (
    echo Cancelado. No se modifico backend\.env
    pause
    exit /b 0
  )
)

copy /Y "deploy\windows\.env.servidor.example" "backend\.env"
if errorlevel 1 (
  echo [ERROR] No se pudo copiar la configuracion.
  pause
  exit /b 1
)

echo.
echo [OK] backend\.env configurado para el servidor.
echo.
echo SIGUIENTE — en pgAdmin cree ^(si no existen^):
echo   Usuario:  turnos
echo   Password: TdCencoic2026Disp
echo   Base:     turnos_dispensario
echo.
echo Luego ejecute:
echo   deploy\windows\1-instalar.bat
echo   deploy\windows\2-iniciar.bat
echo.
echo URLs en la red:
echo   http://192.168.20.26:8741
echo   http://192.168.20.26:8741/tv
echo.
pause
