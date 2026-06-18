@echo off
chcp 65001 >nul
title Turnos Dispensario - Firewall puerto 8741

:: Requiere ejecutar como Administrador
net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Ejecute este script como Administrador.
  echo Clic derecho en el archivo -^> "Ejecutar como administrador"
  pause
  exit /b 1
)

set PORT=8741
set RULE_NAME=Turnos Dispensario TCP %PORT%

echo ============================================
echo   Abrir puerto %PORT% en Firewall Windows
echo   Para acceso desde la red local
echo ============================================
echo.

netsh advfirewall firewall show rule name="%RULE_NAME%" >nul 2>&1
if not errorlevel 1 (
  echo [INFO] La regla "%RULE_NAME%" ya existe.
) else (
  netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% profile=private,domain
  if errorlevel 1 (
    echo [ERROR] No se pudo crear la regla de firewall.
    pause
    exit /b 1
  )
  echo [OK] Regla creada: TCP %PORT% entrada ^(red privada y dominio^).
)

echo.
echo IP del servidor ^(use esta desde otros PCs^):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do echo   http://%%a:%PORT%
echo.
echo Pruebe desde otro PC:
echo   http://IP-DEL-SERVIDOR:%PORT%/api/health
echo.
echo Si sigue sin funcionar:
echo   1. Verifique que Docker este corriendo: docker compose ps
echo   2. En el servidor pruebe: http://localhost:%PORT%/api/health
echo   3. Antivirus o firewall corporativo puede bloquear el puerto
echo.
pause
