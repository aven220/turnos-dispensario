# Ejecutar desde la raíz del proyecto:
#   .\deploy\windows\3-detener-docker.ps1
$bat = Join-Path $PSScriptRoot "3-detener-docker.bat"
& cmd /c "`"$bat`""
exit $LASTEXITCODE
