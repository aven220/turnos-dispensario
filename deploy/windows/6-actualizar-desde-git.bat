@echo off
chcp 65001 >nul
title Turnos Dispensario - Actualizar desde Git

cd /d "%~dp0..\.."

echo ============================================
echo   ACTUALIZAR PROYECTO DESDE GIT
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado.
  pause
  exit /b 1
)

set ENV_BACKUP=
if exist "backend\.env" (
  echo [1/4] Respaldo de backend\.env ...
  copy /Y "backend\.env" "backend\.env.backup" >nul
  set ENV_BACKUP=1
) else (
  echo [1/4] No hay backend\.env ^(se creara despues del pull si hace falta^).
)

echo [2/4] git pull ...
git pull
if errorlevel 1 (
  echo [ERROR] git pull fallo.
  if defined ENV_BACKUP (
    echo Restaurando backend\.env desde respaldo...
    copy /Y "backend\.env.backup" "backend\.env" >nul
  )
  pause
  exit /b 1
)

if defined ENV_BACKUP (
  if not exist "backend\.env" (
    echo [3/4] Restaurando backend\.env desde respaldo...
    copy /Y "backend\.env.backup" "backend\.env" >nul
  ) else (
    echo [3/4] backend\.env conservado ^(git no lo sobrescribe^).
  )
) else (
  echo [3/4] Creando backend\.env para Docker si no existe...
  if not exist "backend\.env" (
    if exist "deploy\windows\.env.servidor-docker.example" (
      copy /Y "deploy\windows\.env.servidor-docker.example" "backend\.env"
    )
  )
)

echo [4/4] Verificando scripts Docker...
if exist "deploy\windows\1-instalar-docker.bat" (
  echo   OK: deploy\windows\1-instalar-docker.bat
) else (
  echo   [AVISO] Falta 1-instalar-docker.bat — el repositorio remoto aun no tiene Docker.
  echo   En la PC de desarrollo: git commit + git push, luego vuelva a ejecutar este script.
)

echo.
echo Listo. Para instalar con Docker:
echo   deploy\windows\1-instalar-docker.bat
echo   PowerShell: .\deploy\windows\1-instalar-docker.ps1
echo.
pause
