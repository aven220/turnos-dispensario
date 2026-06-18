# Arranque completo - Turnos Dispensario (Docker)
# Ejecutar: .\deploy\windows\arranque-completo.ps1

Set-Location (Join-Path $PSScriptRoot "..\..")

Write-Host "============================================"
Write-Host "  ARRANQUE COMPLETO - Turnos Dispensario"
Write-Host "============================================"
Write-Host ""

# --- Docker disponible ---
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker no esta instalado."
    Write-Host "Instale Docker Desktop y vuelva a ejecutar."
    exit 1
}

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker Desktop no esta corriendo."
    Write-Host "Abra Docker Desktop, espere el icono verde y vuelva a ejecutar."
    exit 1
}
Write-Host "[OK] Docker activo"
Write-Host ""

# --- Config .env ---
$envFile = "backend\.env"
$envExample = "deploy\windows\.env.servidor-docker.example"
if (Test-Path $envExample) {
    Copy-Item $envExample $envFile -Force
    Write-Host "[OK] backend\.env configurado (puerto 5544)"
} else {
    Write-Host "[AVISO] No existe $envExample"
}
Write-Host ""

# --- NO usar prisma migrate dev en servidor ---
Write-Host "[INFO] En servidor use Docker, NO npm run db:migrate"
Write-Host ""

# --- Detener contenedores viejos ---
Write-Host "Deteniendo contenedores anteriores..."
docker compose down 2>$null
Write-Host ""

# --- Preguntar reinicio limpio de base ---
$reset = Read-Host "Reiniciar base de datos desde cero? (S/N) - Use S si hubo errores de login o P1000"
if ($reset -eq "S" -or $reset -eq "s") {
    Write-Host "Eliminando volumenes..."
    docker compose down -v
}

# --- Build y arranque ---
Write-Host ""
Write-Host "Construyendo e iniciando (puede tardar varios minutos)..."
$env:SEED_ON_START = "true"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] docker compose up fallo"
    docker compose logs --tail 30
    exit 1
}

Write-Host ""
Write-Host "Esperando que la app arranque..."
$ok = $false
for ($i = 1; $i -le 20; $i++) {
    Start-Sleep -Seconds 3
    try {
        $health = Invoke-RestMethod "http://localhost:8741/api/health" -TimeoutSec 5
        if ($health.status -eq "ok") {
            $ok = $true
            break
        }
    } catch {
        Write-Host "  intento $i/20..."
    }
}

Write-Host ""
Write-Host "=== Estado contenedores ==="
docker compose ps
Write-Host ""

if ($ok) {
    Write-Host "[OK] App respondiendo en puerto 8741"
    Write-Host ""
    try {
        $login = Invoke-RestMethod -Uri "http://localhost:8741/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"CencoicAdmin2026"}'
        Write-Host "[OK] Login admin funciona - rol:" $login.user.role
    } catch {
        Write-Host "[AVISO] Login fallo. Ejecute seed:"
        Write-Host "  docker compose exec app npx tsx prisma/seed.ts"
    }
} else {
    Write-Host "[ERROR] La app no responde en 8741"
    Write-Host ""
    Write-Host "=== Logs app ==="
    docker compose logs app --tail 40
    Write-Host ""
    Write-Host "=== Logs postgres ==="
    docker compose logs postgres --tail 20
    exit 1
}

Write-Host ""
Write-Host "============================================"
Write-Host "  LISTO"
Write-Host "  Local:  http://localhost:8741"
Write-Host "  Red:    http://IP-SERVIDOR:8741"
Write-Host "  Login:  admin / CencoicAdmin2026"
Write-Host ""
Write-Host "  Firewall (como Admin): deploy\windows\7-abrir-firewall.bat"
Write-Host "============================================"
