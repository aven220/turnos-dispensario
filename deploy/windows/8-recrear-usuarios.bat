@echo off
chcp 65001 >nul
title Turnos Dispensario - Recrear usuarios

cd /d "%~dp0..\.."

echo ============================================
echo   RECREAR USUARIOS Y CONTRASEÑAS
echo ============================================
echo.
echo Usuario: admin     Password: CencoicAdmin2026
echo Usuario: filtro    Password: CencoicFiltro2026
echo Usuario: maria/juan/carlos  Password: CencoicVent2026
echo.

where docker >nul 2>&1
if errorlevel 1 goto :local

docker info >nul 2>&1
if errorlevel 1 goto :local

docker compose ps --format "{{.Name}}" 2>nul | findstr /I "turnos-app" >nul 2>&1
if not errorlevel 1 (
  echo Ejecutando seed en contenedor Docker...
  docker compose exec app npx tsx prisma/seed.ts
  if errorlevel 1 goto :error
  echo.
  echo [OK] Usuarios recreados en Docker.
  goto :done
)

:local
echo Ejecutando seed local...
call npm run db:seed
if errorlevel 1 goto :error
echo.
echo [OK] Usuarios recreados localmente.

:done
echo.
echo Pruebe login: http://localhost:8741
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] No se pudo ejecutar el seed.
echo Verifique que Docker o PostgreSQL esten corriendo.
pause
exit /b 1
