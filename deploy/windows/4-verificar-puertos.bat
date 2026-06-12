@echo off
chcp 65001 >nul
title Verificar puertos

echo Puertos locales de Turnos Dispensario:
echo   8741  - Aplicacion web
echo   5544  - PostgreSQL ^(solo 127.0.0.1, no afecta otros programas^)
echo.
echo Comprobando...
echo.

netstat -ano | findstr ":8741 " >nul 2>&1
if errorlevel 1 (echo [OK] Puerto 8741 libre) else (
  echo [OCUPADO] Puerto 8741:
  netstat -ano | findstr ":8741 "
)

netstat -ano | findstr ":5544 " >nul 2>&1
if errorlevel 1 (echo [OK] Puerto 5544 libre) else (
  echo [OCUPADO] Puerto 5544:
  netstat -ano | findstr ":5544 "
)

echo.
pause
