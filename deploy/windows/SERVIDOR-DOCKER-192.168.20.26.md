# Instalación con Docker — servidor 192.168.20.26

Todo corre en Docker: **PostgreSQL** + **aplicación**. No necesita pgAdmin ni Node.js en el servidor (solo Docker).

## Puertos (sin conflictos)

| Servicio | Puerto | Acceso |
|----------|--------|--------|
| Aplicación Turnos | **8741** | Red: `http://192.168.20.26:8741` |
| PostgreSQL Docker | **5544** | Solo `127.0.0.1` (no choca con PostgreSQL en 5432) |

---

## Requisitos

1. **Docker Desktop** instalado y **en ejecución** (ícono verde)
2. Virtualización habilitada en BIOS (requerida por Docker)
3. Puerto **8741** libre

---

## Instalación completa (paso a paso)

### 0. Actualizar desde Git (servidor ya clonado)

`backend\.env` **no está en Git** (es secreto local). Al hacer `git pull` **no se borra** si ya existe.

**Recomendado antes del pull** (por seguridad):
```cmd
copy backend\.env backend\.env.backup
git pull
```
Si tras el pull falta `backend\.env`:
```cmd
copy backend\.env.backup backend\.env
```
O cree uno nuevo:
```cmd
deploy\windows\5-configurar-servidor-docker.bat
```

Script automático:
```cmd
deploy\windows\6-actualizar-desde-git.bat
```

> Si `1-instalar-docker.bat` **no existe** en el servidor, los cambios Docker **aún no están en el remoto**. En la PC de desarrollo hay que hacer `git commit` y `git push`, y luego en el servidor `git pull`.

> **PowerShell:** use `.\` al inicio: `.\deploy\windows\6-actualizar-desde-git.bat`

### 1. Copiar proyecto al servidor

```
C:\Apps\turnos-dispensario
```

### 2. Verificar puertos

```cmd
cd C:\Apps\turnos-dispensario
deploy\windows\4-verificar-puertos.bat
```

### 3. Configurar (opcional)

```cmd
deploy\windows\5-configurar-servidor-docker.bat
```

### 4. Instalar con Docker (una vez)

**CMD:**
```cmd
deploy\windows\1-instalar-docker.bat
```

**PowerShell:**
```powershell
.\deploy\windows\1-instalar-docker.ps1
```

Hace: build imagen → PostgreSQL → migraciones → usuarios iniciales → arranca app.

### 5. Firewall (obligatorio para acceso desde la red)

Desde **otro PC** no entrará si Windows bloquea el puerto. Ejecute **como Administrador**:

```cmd
deploy\windows\7-abrir-firewall.bat
```

PowerShell (admin):
```powershell
.\deploy\windows\7-abrir-firewall.ps1
```

O manual: Firewall de Windows → Reglas de entrada → Nueva → TCP **8741** → Permitir (red privada).

### 6. Probar

```
http://192.168.20.26:8741/api/health
```

Debe responder: `"status":"ok","db":"connected"`

---

## Uso diario

| Acción | CMD | PowerShell |
|--------|-----|------------|
| Instalar | `deploy\windows\1-instalar-docker.bat` | `.\deploy\windows\1-instalar-docker.ps1` |
| Iniciar | `deploy\windows\2-iniciar-docker.bat` | `.\deploy\windows\2-iniciar-docker.ps1` |
| Detener | `deploy\windows\3-detener-docker.bat` | `.\deploy\windows\3-detener-docker.ps1` |
| Ver logs | `docker compose logs -f app` | igual |
| Estado | `docker compose ps` | igual |

Los contenedores tienen `restart: unless-stopped` — se levantan solos al reiniciar Windows si Docker Desktop arranca con el sistema.

---

## URLs

| Módulo | URL |
|--------|-----|
| Login | http://192.168.20.26:8741 |
| Admin | http://192.168.20.26:8741/admin |
| Filtro | http://192.168.20.26:8741/filtro |
| Ventanilla | http://192.168.20.26:8741/ventanilla |
| TV | http://192.168.20.26:8741/tv |

## Credenciales

| Usuario | Contraseña |
|---------|------------|
| admin | CencoicAdmin2026 |
| filtro | CencoicFiltro2026 |
| maria | CencoicVent2026 |

---

## Comandos útiles

```cmd
cd C:\Apps\turnos-dispensario

docker compose ps
docker compose logs -f app
docker compose logs postgres
docker compose restart app
docker compose down
docker compose up -d --build
```

## Si falla la instalación

```cmd
docker compose logs app
docker compose logs postgres
```

Reinstalar datos (¡borra la base!):

```cmd
docker compose down -v
deploy\windows\1-instalar-docker.bat
```

---

## Modo alternativo: solo PostgreSQL en Docker

Si prefiere la app con Node fuera de Docker:

1. `5-configurar-servidor-docker.bat`
2. `1-instalar.bat` (solo levanta postgres)
3. `2-iniciar.bat` (Node en el servidor)

Necesita **Node.js** instalado además de Docker.
