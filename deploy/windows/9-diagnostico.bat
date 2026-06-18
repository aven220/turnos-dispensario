@echo off
chcp 65001 >nul
title Turnos Dispensario - Diagnostico

cd /d "%~dp0..\.."

echo ============================================
echo   DIAGNOSTICO - Turnos Dispensario
echo ============================================
echo.

echo --- IP del servidor ---
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do echo   %%a
echo.

echo --- Puerto 8741 ---
netstat -ano | findstr ":8741 " 
if errorlevel 1 echo   [AVISO] Nada escuchando en 8741
echo.

echo --- Docker ---
where docker >nul 2>&1
if errorlevel 1 (
  echo   Docker no instalado
) else (
  docker compose ps 2>nul
)
echo.

echo --- Salud local ---
curl -s http://localhost:8741/api/health 2>nul
if errorlevel 1 echo   [ERROR] No responde http://localhost:8741/api/health
echo.
echo.

echo --- Prueba login admin ---
curl -s -X POST http://localhost:8741/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"CencoicAdmin2026\"}" 2>nul
echo.
echo.

echo Si la red no entra:
echo   1. Ejecute como Admin: deploy\windows\7-abrir-firewall.bat
echo   2. Use la IP de arriba, NO localhost:  http://IP:8741
echo   3. Recrear usuarios: deploy\windows\8-recrear-usuarios.bat
echo.
pause
