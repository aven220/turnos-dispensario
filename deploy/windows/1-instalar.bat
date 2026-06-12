@echo off
chcp 65001 >nul
title Turnos Dispensario - Instalacion

cd /d "%~dp0..\.."

echo ============================================
echo   INSTALACION - Turnos Dispensario
echo   Base de datos GRATUITA en la nube (Neon)
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado.
  echo Descarguelo de https://nodejs.org/ ^(version LTS 20 o 22^)
  pause
  exit /b 1
)

echo [1/5] Instalando dependencias npm...
call npm install
if errorlevel 1 goto :error

if not exist "backend\.env" (
  echo [2/5] Creando backend\.env ...
  copy /Y "deploy\windows\.env.example" "backend\.env"
) else (
  echo [2/5] backend\.env ya existe, no se sobrescribe.
)

findstr /C:"PEGUE_AQUI" "backend\.env" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ============================================
  echo   CONFIGURE LA BASE DE DATOS GRATUITA
  echo ============================================
  echo.
  echo 1. Abra https://neon.tech en el navegador
  echo 2. Cree cuenta gratis ^(no pide tarjeta^)
  echo 3. Cree proyecto: turnos-dispensario
  echo 4. Copie "Connection string" de PostgreSQL
  echo 5. Peguela en backend\.env en DATABASE_URL
  echo    Agregue al final: ?sslmode=require
  echo.
  echo Se abrira el archivo backend\.env para editarlo...
  pause
  notepad "backend\.env"
  findstr /C:"PEGUE_AQUI" "backend\.env" >nul 2>&1
  if not errorlevel 1 (
    echo [ERROR] Debe pegar su URL de Neon en backend\.env
    pause
    exit /b 1
  )
)

echo [3/5] Aplicando migraciones en Neon...
call npm run db:deploy
if errorlevel 1 goto :error

echo [4/5] Cargando datos iniciales ^(usuarios^)...
call npm run db:seed
if errorlevel 1 goto :error

echo [5/5] Listo.
echo.
echo ============================================
echo   INSTALACION COMPLETADA
echo ============================================
echo.
echo Base de datos: Neon ^(plan gratuito, sin cobros^)
echo Aplicacion local: puerto 8741
echo.
echo Para iniciar ejecute: deploy\windows\2-iniciar.bat
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] La instalacion fallo. Revise los mensajes anteriores.
echo Si fallo la conexion, verifique DATABASE_URL en backend\.env
pause
exit /b 1
