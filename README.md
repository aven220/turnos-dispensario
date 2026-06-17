# Sistema Web de Gestión Inteligente de Turnos para Dispensarios

Aplicación web en tiempo real para gestión de turnos en dispensarios y puntos de atención.

---

## Contenido

1. [Requisitos](#requisitos)
2. [Instalación completa — desarrollo](#instalación-completa--desarrollo)
3. [Instalación completa — Windows Server](#instalación-completa--windows-server)
4. [Instalación completa — Linux](#instalación-completa--linux)
5. [Configuración después de instalar](#configuración-después-de-instalar)
6. [Pantalla TV y voz de llamados](#pantalla-tv-y-voz-de-llamados)
7. [Accesos y credenciales](#accesos-y-credenciales)
8. [Actualizar el sistema](#actualizar-el-sistema)
9. [Operación diaria y solución de problemas](#operación-diaria-y-solución-de-problemas)
10. [Stack y estructura](#stack-y-estructura)

---

## Requisitos

| Componente | Versión recomendada |
|------------|---------------------|
| Node.js | 20 LTS o 22 LTS |
| npm | Incluido con Node.js |
| PostgreSQL | 16 (vía Docker o instalado) |
| Docker | Opcional pero recomendado |
| Navegador TV | Chrome o Edge (para voz de llamados) |

**No compatible con XAMPP** — este proyecto usa PostgreSQL, no MySQL.

---

## Instalación completa — desarrollo

Para programar o probar en su PC (Mac, Linux o Windows):

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
```

### 2. Levantar PostgreSQL

```bash
docker compose up -d --wait
```

PostgreSQL queda en `127.0.0.1:5544` con usuario `turnos` y base `turnos_dispensario`.

### 3. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
```

Revise `DATABASE_URL` y `JWT_SECRET` en `backend/.env`.

### 4. Instalar dependencias y base de datos

```bash
npm install
npm run db:deploy    # aplica todas las migraciones
npm run db:seed      # usuarios y datos iniciales
```

### 5. Iniciar en modo desarrollo

```bash
npm run dev
```

| Servicio | URL |
|----------|-----|
| Login / Admin | http://localhost:5173 |
| API backend | http://localhost:4000 |
| Pantalla TV | http://localhost:5173/tv |
| Salud del sistema | http://localhost:4000/api/health |

---

## Instalación completa — Windows Server

### Requisitos

- Windows Server 2019+ o Windows 10/11
- [Node.js LTS 20 o 22](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recomendado) **o** PostgreSQL instalado en Windows

### Paso 1 — Obtener el proyecto

```cmd
cd C:\Apps
git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
```

### Paso 2 — Verificar puerto libre

```cmd
deploy\windows\4-verificar-puertos.bat
```

El puerto **8741** debe estar libre (aplicación web + API + sockets).

### Paso 3 — Instalación automática (una sola vez)

```cmd
deploy\windows\1-instalar.bat
```

El script ejecuta en orden:

1. `npm install` — dependencias
2. Crea `backend\.env` desde `deploy\windows\.env.example` (si no existe)
3. Levanta PostgreSQL en Docker (puerto 5544) si Docker está disponible
4. `npm run db:deploy` — migraciones de base de datos
5. `npm run db:seed` — usuarios y configuración inicial

### Paso 4 — Iniciar la aplicación

```cmd
deploy\windows\2-iniciar.bat
```

Compila frontend + backend y arranca en el puerto **8741**.

### Paso 5 — Verificar

| Qué | URL |
|-----|-----|
| Login | http://localhost:8741 |
| Administrador | http://localhost:8741/admin |
| Pantalla TV | http://localhost:8741/tv |
| Salud | http://localhost:8741/api/health |
| Desde otro PC en la red | http://IP-DEL-SERVIDOR:8741 |

Respuesta correcta de salud:

```json
{ "status": "ok", "db": "connected", "uptimeSeconds": 120 }
```

### Paso 6 — Arranque automático (opcional)

1. Abra **Programador de tareas** de Windows
2. Crear tarea → Al iniciar el equipo
3. Acción: `C:\Apps\turnos-dispensario\deploy\windows\2-iniciar.bat`
4. Docker Desktop debe iniciar con Windows si usa base de datos en contenedor

### Sin Docker (PostgreSQL instalado en Windows)

1. Instale PostgreSQL 16
2. Cree usuario `turnos`, contraseña y base `turnos_dispensario`
3. Edite `backend\.env`:

```
DATABASE_URL=postgresql://turnos:SU_CONTRASEÑA@127.0.0.1:5432/turnos_dispensario
PORT=8741
HOST=0.0.0.0
NODE_ENV=production
JWT_SECRET=una-clave-larga-y-segura
CORS_ORIGIN=*
```

4. Ejecute `deploy\windows\1-instalar.bat` (omitirá Docker si no está instalado)

---

## Instalación completa — Linux

### Requisitos

- Ubuntu 22.04+ / Debian 12+
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

El script `install.sh` hace: `npm install`, crea `.env`, levanta Docker, migraciones, seed y `npm run build`.

### Iniciar manualmente

```bash
./deploy/linux/start.sh
```

### Iniciar con PM2 (recomendado — reinicio automático)

```bash
./deploy/linux/start-pm2.sh
pm2 startup    # siga las instrucciones en pantalla
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

### Firewall

```bash
sudo ufw allow 8741/tcp
```

---

## Configuración después de instalar

Entre con el usuario **admin** y configure en este orden:

| Paso | Panel | Qué configurar |
|------|-------|----------------|
| 1 | **Prioridades** | Tipos de turno (código, nombre, orden de atención) |
| 2 | **Usuarios** | Operadores de filtro y ventanilla |
| 3 | **Ventanillas** | Número, operador asignado, prioridades que atiende |
| 4 | **Pantalla TV** | Mensaje de bienvenida, ticker, multimedia, **voz y velocidad** |
| 5 | **Impresión turno** | Formato del ticket impreso en filtro |

Abra la TV en otra pestaña: `http://IP-SERVIDOR:8741/tv` (F11 pantalla completa).

---

## Pantalla TV y voz de llamados

La pantalla TV **no requiere login**. Se abre directamente en el navegador del televisor o PC conectado a la TV.

### Configurar voz (Admin → Pantalla TV → Multimedia TV)

Debajo de la sección de videos/imágenes encontrará **Voz de llamados (TV)**:

| Opción | Descripción |
|--------|-------------|
| **Neutra automática** | Recomendada. Usa español de España (`es-ES`) sin acento regional |
| **Voz específica** | Lista de voces en español detectadas en el navegador |
| **Velocidad** | Deslizador de 0.6 (lenta) a 1.2 (rápida). Por defecto 0.9 |
| **Probar voz** | Escucha un ejemplo antes de guardar |

Pulse **Guardar configuración TV** o **Guardar voz y configuración TV**.

> **Importante:** Las voces dependen del navegador y sistema operativo de la **pantalla TV**. Si configura desde otro PC, use "Neutra automática" para que la TV elija la mejor voz disponible en su equipo. Recomendado: **Chrome o Edge** en la TV.

Los cambios se aplican en tiempo real (la TV recibe la actualización sin recargar).

### Contenido multimedia

- Suba archivos MP4, WebM o imágenes
- O pegue enlaces (YouTube, MP4 directo)
- Configure mensajes del ticker inferior

---

## Accesos y credenciales

### Módulos del sistema

| Módulo | Ruta | Quién entra |
|--------|------|-------------|
| Login | `/` | Todos los operadores |
| Administrador | `/admin` | Usuario `admin` |
| Filtro | `/filtro` | Usuario `filtro` |
| Ventanilla | `/ventanilla` | Operadores de ventanilla |
| **Pantalla TV** | `/tv` | Sin login (abrir directo en la TV) |

### Usuarios por defecto (cámbielos en producción)

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | `CencoicAdmin2026` | Administrador |
| filtro | `CencoicFiltro2026` | Filtro |
| maria / juan / carlos | `CencoicVent2026` | Ventanilla |

### PostgreSQL (Docker local)

| Campo | Valor |
|-------|-------|
| Usuario | `turnos` |
| Contraseña | `TdCencoic2026Disp` |
| Base de datos | `turnos_dispensario` |
| Puerto | `5544` (solo localhost) |

### Variables de entorno (`backend/.env`)

| Variable | Descripción | Producción |
|----------|-------------|------------|
| `DATABASE_URL` | Conexión PostgreSQL | Ver plantillas en `deploy/windows/.env.example` |
| `JWT_SECRET` | Clave de sesiones | Cadena larga y única |
| `PORT` | Puerto único (web + API + sockets) | `8741` |
| `HOST` | Interfaz de red | `0.0.0.0` |
| `CORS_ORIGIN` | Orígenes permitidos | `*` (red local) |
| `NODE_ENV` | Entorno | `production` |

Plantillas: `backend/.env.example`, `deploy/windows/.env.example`, `deploy/linux/.env.example`

---

## Actualizar el sistema

Siempre detenga, actualice código, aplique migraciones y reinicie:

### Windows

```cmd
cd C:\Apps\turnos-dispensario
deploy\windows\3-detener.bat
git pull
npm install
npm run db:deploy
deploy\windows\2-iniciar.bat
```

### Linux

```bash
cd /opt/turnos-dispensario
pm2 stop turnos-dispensario   # o detenga el servicio systemd
git pull
npm install
npm run db:deploy
npm run build
pm2 restart turnos-dispensario
```

`npm run db:deploy` aplica migraciones nuevas (por ejemplo configuración de voz TV) sin borrar datos.

---

## Operación diaria y solución de problemas

### Robustez incluida

- Reintento de conexión a BD al arrancar
- Health check en `/api/health`
- Reinicio diario automático de turnos del día anterior
- Reconexión Socket.IO en el navegador
- CORS flexible para TVs y PCs en red local
- Docker con `restart: unless-stopped`

### Si algo deja de funcionar

1. Verifique salud: `http://SU-SERVIDOR:8741/api/health`
2. Si `db: disconnected`:
   ```bash
   docker compose up -d --wait
   ```
3. Reinicie la aplicación
4. Cierre sesión y vuelva a entrar si cambió `JWT_SECRET`

### Pantalla TV

- URL fija: `http://IP-SERVIDOR:8741/tv`
- Modo pantalla completa (F11)
- No cierre la pestaña; reconecta sola tras cortes breves de red
- Si no hay audio: verifique volumen del sistema, use Chrome/Edge, y pruebe la voz en Admin

### Modo pausa en ventanilla

Los operadores pueden poner **En pausa** al salir a almorzar. El administrador lo ve en Ventanillas y Estadísticas.

---

## Stack y estructura

### Stack tecnológico

- **Frontend:** React 19, Vite, Tailwind CSS 4
- **Backend:** Node.js, Express 5, Socket.IO, Prisma
- **Base de datos:** PostgreSQL 16
- **Autenticación:** JWT

### Estructura del proyecto

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

### Reglas de negocio

1. Un turno, un estado — GENERADO → LLAMADO → ATENDIENDO → FINALIZADO / AUSENTE / CANCELADO
2. Una ventanilla, un turno activo
3. Un operador, una ventanilla
4. Asignación transaccional (`SELECT FOR UPDATE SKIP LOCKED`)
5. Auditoría completa de acciones
6. Máximo 3 llamados por turno
7. Tiempo real con Socket.IO
8. Modo pausa en ventanilla (sin tomar turnos nuevos)

---

## Comandos útiles

```bash
docker compose up -d --wait     # Levantar PostgreSQL
npm run dev                     # Desarrollo
npm run build                   # Compilar producción
npm run db:deploy               # Migraciones
npm run db:seed                 # Datos iniciales
npm run health                  # Probar /api/health (puerto 8741)
```
