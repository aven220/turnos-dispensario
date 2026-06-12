@echo off
chcp 65001 >nul
title Verificar puertos

echo Puerto que usara Turnos Dispensario en este servidor:
echo   8741  - Aplicacion web
echo.
echo La base de datos esta en Neon ^(nube^), no usa puertos locales.
echo.
echo Comprobando si el puerto 8741 esta libre...
echo.

netstat -ano | findstr ":8741 " >nul 2>&1
if errorlevel 1 (
  echo [OK] Puerto 8741 libre
) else (
  echo [OCUPADO] Puerto 8741 en uso:
  netstat -ano | findstr ":8741 "
)

echo.
pause
