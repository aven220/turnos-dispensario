@echo off
chcp 65001 >nul
title Turnos Dispensario - Detener todo

cd /d "%~dp0..\.."

echo Deteniendo contenedores Docker...
docker compose down 2>nul

echo.
echo Cierre otras ventanas donde corra npm run dev o 2-iniciar.bat
echo.
echo Si prisma da error EPERM, ejecute UNA sola vez:
echo   npm run db:generate
echo.
echo Para produccion use SOLO Docker:
echo   deploy\windows\2-iniciar-docker.bat
echo.
pause
