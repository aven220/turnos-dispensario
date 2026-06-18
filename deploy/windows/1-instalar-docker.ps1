# Ejecutar desde la raíz del proyecto:
#   .\deploy\windows\1-instalar-docker.ps1
$bat = Join-Path $PSScriptRoot "1-instalar-docker.bat"
& cmd /c "`"$bat`""
exit $LASTEXITCODE
