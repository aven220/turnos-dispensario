#Requires -Version 5.1
# Corregir DATABASE_URL para Docker (puerto 5544)
# Ejecutar: .\deploy\windows\fix-db.ps1

Set-Location (Join-Path $PSScriptRoot "..\..")

Write-Host "============================================"
Write-Host "  FIX - PostgreSQL Docker puerto 5544"
Write-Host "============================================"
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker no encontrado."
    exit 1
}

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Abra Docker Desktop primero."
    exit 1
}

$envExample = "deploy\windows\.env.servidor-docker.example"
$envTarget = "backend\.env"

if (-not (Test-Path $envExample)) {
    Write-Host "[ERROR] No existe $envExample"
    Write-Host "Actualice el proyecto (git pull) o copie los archivos nuevos."
    exit 1
}

Write-Host "[1/5] Configurando backend\.env..."
Copy-Item $envExample $envTarget -Force
Write-Host ""

Write-Host "[2/5] Iniciando PostgreSQL Docker..."
docker compose up -d postgres
Start-Sleep -Seconds 12
docker compose ps postgres
Write-Host ""

Write-Host "[3/5] DATABASE_URL:"
Select-String -Path $envTarget -Pattern "DATABASE_URL"
Write-Host ""

Write-Host "[4/5] Migraciones..."
npm run db:deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] db:deploy fallo. Revise: docker compose logs postgres"
    exit 1
}

Write-Host ""
Write-Host "[5/5] Usuarios..."
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "============================================"
Write-Host "  LISTO"
Write-Host "  Login: admin / CencoicAdmin2026"
Write-Host "  App:   deploy\windows\2-iniciar-docker.bat"
Write-Host "============================================"
