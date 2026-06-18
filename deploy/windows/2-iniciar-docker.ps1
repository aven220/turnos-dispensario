# Ejecutar desde la raíz del proyecto:
#   .\deploy\windows\2-iniciar-docker.ps1
$bat = Join-Path $PSScriptRoot "2-iniciar-docker.bat"
& cmd /c "`"$bat`""
exit $LASTEXITCODE
