@echo off
chcp 65001 >nul
title Turnos Dispensario - Detener

cd /d "%~dp0..\.."

where docker >nul 2>&1
if not errorlevel 1 (
  docker compose ps --format "{{.Name}}" 2>nul | findstr /I "turnos-app turnos-postgres" >nul 2>&1
  if not errorlevel 1 (
    echo Deteniendo contenedores Docker...
    docker compose down
    goto :done
  )
)

echo PostgreSQL nativo: use Servicios de Windows si necesita detenerlo.
echo App sin Docker: cierre la ventana de 2-iniciar.bat con Ctrl+C.

:done
echo.
echo Datos conservados.
pause
