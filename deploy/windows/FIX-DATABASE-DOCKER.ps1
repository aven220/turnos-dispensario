# Ejecutar desde la raiz del proyecto:
#   .\deploy\windows\FIX-DATABASE-DOCKER.ps1
$bat = Join-Path $PSScriptRoot "FIX-DATABASE-DOCKER.bat"
& cmd /c "`"$bat`""
exit $LASTEXITCODE
