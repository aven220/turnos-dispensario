# Verificar login admin
Set-Location (Join-Path $PSScriptRoot "..\..")

Write-Host "=== Verificar admin en base local (backend\.env) ==="
npm run db:verify-admin
Write-Host ""

Write-Host "=== Probar login HTTP puerto 8741 (Docker) ==="
try {
    $body = '{"username":"admin","password":"CencoicAdmin2026"}'
    $r = Invoke-RestMethod -Uri "http://localhost:8741/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "OK login 8741 - usuario:" $r.user.username "rol:" $r.user.role
} catch {
    Write-Host "FALLO login 8741:" $_.Exception.Message
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}

Write-Host ""
Write-Host "=== Probar login HTTP puerto 4000 (dev Node) ==="
try {
    $body = '{"username":"admin","password":"CencoicAdmin2026"}'
    $r = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "OK login 4000 - usuario:" $r.user.username
} catch {
    Write-Host "Puerto 4000 no responde o fallo login (normal si solo usa Docker)"
}

Write-Host ""
Write-Host "=== Seed dentro from Docker app (misma base que 8741) ==="
docker compose exec app npx tsx prisma/seed.ts 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Seed en contenedor OK. Reiniciando app..."
    docker compose restart app
}

Write-Host ""
Write-Host "Pruebe de nuevo: http://localhost:8741  admin / CencoicAdmin2026"
