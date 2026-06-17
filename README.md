# Sistema Web de Gestión Inteligente de Turnos para Dispensarios

Aplicación web en tiempo real para gestión de turnos en dispensarios y puntos de atención.

## Accesos del sistema

| Módulo | Ruta | Quién entra |
|--------|------|-------------|
| Login | `/` | Todos los operadores |
| Administrador | `/admin` | Usuario `admin` |
| Filtro | `/filtro` | Usuario `filtro` |
| Ventanilla | `/ventanilla` | Operadores de ventanilla |
| **Pantalla TV** | `/tv` | **Solo abrir directo en el navegador de la TV** (no aparece en login) |

> La pantalla TV no requiere usuario. En el panel admin hay un enlace **TV** para abrirla en otra pestaña al configurarla.

---

## Configuración rápida (`backend/.env`)

Copie la plantilla según su entorno:

| Archivo plantilla | Uso |
|-------------------|-----|
| `backend/.env.example` | Desarrollo local |
| `deploy/windows/.env.example` | Servidor Windows |
| `deploy/linux/.env.example` | Servidor Linux |

Variables importantes:

| Variable | Descripción | Producción recomendada |
|----------|-------------|------------------------|
| `DATABASE_URL` | Conexión PostgreSQL | `postgresql://turnos:...@127.0.0.1:5544/turnos_dispensario` |
| `JWT_SECRET` | Clave de sesiones | Cadena larga y única |
| `PORT` | Puerto único (web + API + sockets) | `8741` |
| `HOST` | Interfaz de red | `0.0.0.0` (acceso en red local) |
| `CORS_ORIGIN` | Orígenes permitidos | `*` (otros PCs en la red) |
| `NODE_ENV` | Entorno | `production` en servidor |

---

## Credenciales por defecto (cámbielas en producción)

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | `CencoicAdmin2026` | Administrador |
| filtro | `CencoicFiltro2026` | Filtro |
| maria / juan / carlos | `CencoicVent2026` | Ventanilla |

PostgreSQL local (Docker):

| Campo | Valor |
|-------|-------|
| Usuario | `turnos` |
| Contraseña | `TdCencoic2026Disp` |
| Base de datos | `turnos_dispensario` |
| Puerto | `5544` (solo localhost) |

---

## Producción en Windows Server

### Requisitos

- Windows Server 2019+ o Windows 10/11
- [Node.js LTS 20 o 22](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recomendado) **o** PostgreSQL instalado

### Paso 1 — Clonar el proyecto

```cmd
cd C:\Apps
git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
```

### Paso 2 — Verificar puerto libre

```cmd
deploy\windows\4-verificar-puertos.bat
```

El puerto **8741** debe estar libre.

### Paso 3 — Instalar (una sola vez)

```cmd
deploy\windows\1-instalar.bat
```

Este script:

1. Instala dependencias npm
2. Crea `backend\.env` desde la plantilla
3. Levanta PostgreSQL en Docker (puerto 5544)
4. Aplica migraciones de base de datos
5. Carga usuarios y datos iniciales

### Paso 4 — Iniciar la aplicación

```cmd
deploy\windows\2-iniciar.bat
```

### Paso 5 — Probar

| Qué | URL |
|-----|-----|
| Login | http://localhost:8741 |
| Salud del sistema | http://localhost:8741/api/health |
| Pantalla TV | http://localhost:8741/tv |
| Desde otro PC en la red | http://IP-DEL-SERVidor:8741 |

Respuesta correcta de salud:

```json
{ "status": "ok", "db": "connected", "uptimeSeconds": 120 }
```

### Paso 6 — Arranque automático al encender el servidor (opcional)

1. Abra **Programador de tareas** de Windows
2. Crear tarea básica → Al iniciar el equipo
3. Acción: Iniciar programa → `C:\Apps\turnos-dispensario\deploy\windows\2-iniciar.bat`
4. Marque **Ejecutar con los privilegios más altos** si Docker lo requiere

> Docker Desktop debe configurarse para iniciar con Windows.

### Actualizar versión en el servidor

```cmd
cd C:\Apps\turnos-dispensario
deploy\windows\3-detener.bat
git pull
npm install
npm run db:deploy
deploy\windows\2-iniciar.bat
```

---

## Producción en Linux (Ubuntu / Debian)

### Requisitos

- Node.js 20 LTS
- Docker (recomendado) o PostgreSQL 16
- Git

### Instalación

```bash
cd /opt
sudo git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
sudo chown -R $USER:$USER .

chmod +x deploy/linux/*.sh
./deploy/linux/install.sh
```

### Iniciar manualmente

```bash
./deploy/linux/start.sh
```

### Iniciar con PM2 (recomendado — se reinicia solo si falla)

```bash
./deploy/linux/start-pm2.sh
pm2 startup    # seguir instrucciones para arranque al boot
pm2 save
```

### Servicio systemd (alternativa)

```bash
sudo cp deploy/linux/turnos-dispensario.service /etc/systemd/system/
# Edite User= y rutas si no usa /opt/turnos-dispensario
sudo systemctl daemon-reload
sudo systemctl enable turnos-dispensario
sudo systemctl start turnos-dispensario
sudo systemctl status turnos-dispensario
```

### Firewall (acceso desde la red)

```bash
sudo ufw allow 8741/tcp
```

---

## Desarrollo local (Mac / Linux / Windows)

```bash
docker compose up -d --wait
cp backend/.env.example backend/.env
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| TV (dev) | http://localhost:5173/tv |

---

## Base de datos

### Docker (recomendado)

```bash
docker compose up -d --wait
```

- Contenedor: `turnos-postgres`
- Reinicio automático: `unless-stopped`
- Datos persistentes en volumen `turnos_pg_data`
- Healthcheck integrado

### Sin Docker (PostgreSQL instalado)

Cree usuario y base de datos, luego ajuste `DATABASE_URL` en `backend/.env`. Ver sección en versiones anteriores del README o documentación de PostgreSQL.

### XAMPP

**No compatible.** XAMPP usa MySQL; este proyecto requiere **PostgreSQL**.

---

## Robustez y operación diaria

El sistema incluye:

- **Reintento de conexión a BD** al arrancar (hasta 30 s)
- **Health check** en `/api/health` (verifica base de datos)
- **Reinicio diario automático** de turnos del día anterior (cada hora y en cada operación)
- **Reconexión Socket.IO** en el navegador si se pierde la red
- **CORS flexible** (`CORS_ORIGIN=*`) para TVs y PCs en la red local
- **Cierre ordenado** del servidor (SIGINT / SIGTERM)
- **Docker** con `restart: unless-stopped` y healthcheck

### Si algo deja de funcionar

1. Verifique salud: `http://SU-SERVIDOR:8741/api/health`
2. Si `db: disconnected`:
   ```bash
   docker compose up -d --wait
   ```
3. Reinicie la aplicación (`2-iniciar.bat` o `pm2 restart turnos-dispensario`)
4. Revise que `JWT_SECRET` y `DATABASE_URL` no hayan cambiado sin reiniciar sesiones en el navegador

### Pantalla TV

- Abra **solo** `http://IP-SERVIDOR:8741/tv` en el navegador de la TV
- Use modo pantalla completa (F11)
- No cierre esa pestaña; el sistema reconecta solo si hay un corte breve de red

---

## Estructura del proyecto

```
turnos-dispensario/
├── backend/              API Express + Socket.IO + Prisma
├── frontend/             React + Vite + Tailwind
├── deploy/
│   ├── windows/          Scripts .bat para Windows Server
│   ├── linux/            Scripts .sh + systemd
│   └── pm2/              Configuración PM2
├── docker-compose.yml    PostgreSQL local
└── README.md
```

---

## Reglas de negocio

1. Un turno, un estado — GENERADO → LLAMADO → ATENDIENDO → FINALIZADO / AUSENTE / CANCELADO
2. Una ventanilla, un turno activo
3. Asignación transaccional (`SELECT FOR UPDATE SKIP LOCKED`)
4. Auditoría completa de acciones
5. Máximo 3 llamados por turno
6. Tiempo real con Socket.IO

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4
- **Backend:** Node.js, Express 5, Socket.IO, Prisma
- **Base de datos:** PostgreSQL 16
- **Autenticación:** JWT
