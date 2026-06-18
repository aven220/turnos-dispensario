# Reparar contenedor app en bucle de reinicio
Set-Location (Join-Path $PSScriptRoot "..\..")

Write-Host "============================================"
Write-Host "  REPARAR DOCKER - Turnos Dispensario"
Write-Host "============================================"
Write-Host ""

Write-Host "--- Ultimos logs del contenedor app ---"
docker compose logs app --tail 40
Write-Host ""

Write-Host "[1/6] Deteniendo contenedores..."
docker compose down
Write-Host ""

Write-Host "[2/6] Eliminando volumen PostgreSQL (reinicio limpio de credenciales)..."
Write-Host "      Esto borra turnos anteriores en la base."
$confirm = Read-Host "Continuar? (S/N)"
if ($confirm -ne "S" -and $confirm -ne "s") {
    Write-Host "Cancelado."
    exit 0
}

docker compose down -v
Write-Host ""

Write-Host "[3/6] Configurando backend\.env puerto 5544..."
Copy-Item "deploy\windows\.env.servidor-docker.example" "backend\.env" -Force
Write-Host ""

Write-Host "[4/6] Reconstruyendo imagen..."
docker compose build app
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host ""

Write-Host "[5/6] Iniciando con seed..."
$env:SEED_ON_START = "true"
docker compose up -d
Start-Sleep -Seconds 25
Write-Host ""

Write-Host "[6/6] Estado:"
docker compose ps
Write-Host ""

Write-Host "--- Salud ---"
try {
    Invoke-RestMethod "http://localhost:8741/api/health"
} catch {
    Write-Host "Aun no responde. Espere 30s y pruebe: http://localhost:8741/api/health"
}

Write-Host ""
Write-Host "--- Login ---"
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8741/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"CencoicAdmin2026"}'
    Write-Host "OK login admin rol:" $r.user.role
} catch {
    Write-Host "Login fallo. Logs: docker compose logs app --tail 50"
}

Write-Host ""
Write-Host "URL: http://IP-SERVIDOR:8741  admin / CencoicAdmin2026"
