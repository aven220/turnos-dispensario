@echo off
chcp 65001 >nul
title Turnos Dispensario - Corregir conexion base de datos

cd /d "%~dp0..\.."

echo ============================================
echo   CORREGIR DATABASE_URL
echo ============================================
echo.

if exist "backend\.env" (
  echo DATABASE_URL actual:
  findstr DATABASE_URL backend\.env
  echo.
) else (
  echo [AVISO] No existe backend\.env
)

echo PostgreSQL Docker usa:
echo   Host: 127.0.0.1
echo   Puerto: 5544
echo   Usuario: turnos
echo   Password: TdCencoic2026Disp
echo   Base: turnos_dispensario
echo.

where docker >nul 2>&1
if not errorlevel 1 (
  docker info >nul 2>&1
  if not errorlevel 1 (
    echo Iniciando PostgreSQL Docker si no esta corriendo...
    docker compose up -d postgres
    timeout /t 5 /nobreak >nul
    docker compose ps postgres
    echo.
  )
)

echo.
choice /C 12 /M "Modo: [1] Docker PostgreSQL 5544  [2] PostgreSQL nativo 5432"
if errorlevel 2 goto :native
if errorlevel 1 goto :docker

:docker
copy /Y "deploy\windows\.env.servidor-docker.example" "backend\.env"
echo.
echo [OK] backend\.env configurado para Docker ^(puerto 5544^).
echo.
echo Si usa npm run dev, edite backend\.env y cambie:
echo   PORT=4000
echo   CORS_ORIGIN=http://localhost:5174
echo.
echo Si usa 2-iniciar.bat ^(sin Docker app^), deje PORT=8741.
goto :seed

:native
copy /Y "deploy\windows\.env.servidor.example" "backend\.env"
echo.
echo [OK] backend\.env configurado para PostgreSQL nativo ^(5432^).
echo.
echo Debe crear en pgAdmin:
echo   Usuario: turnos  Password: TdCencoic2026Disp
echo   Base: turnos_dispensario
goto :seed

:seed
echo.
choice /C SN /M "Aplicar migraciones y recrear usuarios ahora"
if errorlevel 2 goto :end
call npm run db:deploy
if errorlevel 1 (
  echo [ERROR] Migraciones fallaron. Verifique que PostgreSQL este corriendo.
  goto :end
)
call npm run db:seed
if errorlevel 1 (
  echo [ERROR] Seed fallo.
  goto :end
)
echo [OK] Base de datos lista.

:end
echo.
echo Probar:
echo   Docker app:  deploy\windows\2-iniciar-docker.bat
echo   Node local:  deploy\windows\2-iniciar.bat
echo   Desarrollo:  npm run dev  ^(PORT=4000 en backend\.env^)
echo.
pause
