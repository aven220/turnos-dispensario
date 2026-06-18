@echo off
chcp 65001 >nul
title Verificar puertos

cd /d "%~dp0..\.."

echo Puertos Turnos Dispensario ^(servidor 192.168.20.26^):
echo   8741  - Aplicacion web ^(unico puerto expuesto a la red^)
echo   5432  - PostgreSQL nativo ^(solo localhost, compartido con pgAdmin^)
echo   5544  - Solo si usa Docker ^(NO recomendado si ya tiene PostgreSQL^)
echo.
echo Comprobando...
echo.

netstat -ano | findstr ":8741 " >nul 2>&1
if errorlevel 1 (echo [OK] Puerto 8741 libre - listo para Turnos) else (
  echo [OCUPADO] Puerto 8741 - cambie PORT en backend\.env o libere el puerto:
  netstat -ano | findstr ":8741 "
)

echo.
netstat -ano | findstr ":5432 " >nul 2>&1
if errorlevel 1 (
  echo [AVISO] Puerto 5432 libre - PostgreSQL no parece estar en ejecucion
) else (
  echo [OK] Puerto 5432 en uso - normal si PostgreSQL/pgAdmin ya esta instalado
)

echo.
netstat -ano | findstr ":5544 " >nul 2>&1
if errorlevel 1 (echo [OK] Puerto 5544 libre) else (
  echo [INFO] Puerto 5544 ocupado ^(Docker u otro servicio^)
)

echo.
if exist "backend\.env" (
  echo Configuracion actual ^(backend\.env^):
  findstr /B "PORT= PUBLIC_SERVER_IP= DATABASE_URL=" backend\.env 2>nul
) else (
  echo [AVISO] No existe backend\.env - ejecute 5-configurar-servidor.bat
)
echo.
pause
