@echo off
chcp 65001 >nul
title Turnos Dispensario - Detener base de datos

cd /d "%~dp0..\.."

where docker >nul 2>&1
if errorlevel 1 (
  echo PostgreSQL instalado en Windows: no se detiene desde aqui.
  echo Use "Servicios de Windows" si necesita detenerlo.
  goto :done
)

echo Deteniendo PostgreSQL local de Turnos ^(solo Docker^)...
docker compose down

:done
echo.
echo La aplicacion se detiene con Ctrl+C en la ventana de 2-iniciar.bat.
echo Sus datos locales se conservan.
echo.
pause
