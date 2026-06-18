#Requires -RunAsAdministrator
# Abrir puerto 8741 para acceso desde la red
# Ejecutar: clic derecho -> Ejecutar con PowerShell (como administrador)

$Port = 8741
$RuleName = "Turnos Dispensario TCP $Port"

Write-Host "============================================"
Write-Host "  Abrir puerto $Port en Firewall Windows"
Write-Host "============================================"
Write-Host ""

$existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[INFO] La regla ya existe."
} else {
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private,Domain | Out-Null
    Write-Host "[OK] Regla creada: TCP $Port entrada."
}

Write-Host ""
Write-Host "IP del servidor (use desde otros PCs):"
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | ForEach-Object {
    Write-Host "  http://$($_.IPAddress):$Port"
}
Write-Host ""
Write-Host "Pruebe desde otro PC:"
Write-Host "  http://IP-DEL-SERVIDOR:$Port/api/health"
Write-Host ""
Read-Host "Presione Enter para cerrar"
