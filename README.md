# Sistema Web de Gestión Inteligente de Turnos para Dispensarios

Aplicación web en tiempo real para gestión de turnos en dispensarios, centros médicos y puntos de atención.

## Módulos

| Módulo | Ruta | Rol |
|--------|------|-----|
| Panel Administrador | `/admin` | ADMIN |
| Módulo Filtro | `/filtro` | FILTER |
| Módulo Ventanilla | `/ventanilla` | WINDOW |
| Pantalla TV | `/tv` | Público |

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Socket.IO Client
- **Backend:** Node.js, Express 5, Socket.IO, Prisma
- **Base de datos:** PostgreSQL (Docker)
- **Autenticación:** JWT

---

## Credenciales del sistema

> Guarde este bloque. Si el repositorio es público, cambie todas las contraseñas antes de desplegar.

### Base de datos PostgreSQL

| Campo | Valor |
|-------|-------|
| Usuario | `turnos` |
| Contraseña | `TdCencoic2026Disp` |
| Base de datos | `turnos_dispensario` |
| Puerto (local) | `5544` (solo `127.0.0.1`) |

### JWT (backend)

```
JWT_SECRET=cencoic-turnos-jwt-2026-k8mP2xQ9vL4nR7wZ6sH3fA1bN5jD0eU
```

### Usuarios de la aplicación

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | `CencoicAdmin2026` | Administrador |
| filtro | `CencoicFiltro2026` | Filtro |
| maria | `CencoicVent2026` | Ventanilla 1 |
| juan | `CencoicVent2026` | Ventanilla 2 |
| carlos | `CencoicVent2026` | Ventanilla 3 |

### Puertos

| Entorno | Aplicación | PostgreSQL |
|---------|------------|------------|
| Desarrollo (Mac/local) | Frontend `5173` + Backend `4000` | `5544` |
| Producción (Windows) | **Un solo puerto `8741`** | `5544` |

---

## Subir a GitHub

```bash
cd turnos-dispensario
git remote add origin https://github.com/TU-USUARIO/turnos-dispensario.git
git push -u origin main
```

Reemplace `TU-USUARIO` por su cuenta de GitHub. El archivo `backend/.env` **no** se sube (está en `.gitignore`). La plantilla con valores listos está en `deploy/windows/.env.example`.

---

## Desarrollo local (Mac / Linux)

### 1. Base de datos

```bash
docker compose up -d
```

### 2. Configuración

```bash
cp backend/.env.example backend/.env
```

### 3. Instalar y migrar

```bash
npm install
npm run db:migrate
npm run db:seed
```

### 4. Ejecutar

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Pantalla TV: http://localhost:5173/tv

---

## Producción en Windows Server

### Requisitos

- Node.js LTS 20 o 22
- Git
- Docker Desktop

### 1. Clonar desde GitHub

```cmd
cd C:\Apps
git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
```

### 2. Verificar puertos libres

Ejecutar: `deploy\windows\4-verificar-puertos.bat`

### 3. Instalar (una sola vez)

Ejecutar: `deploy\windows\1-instalar.bat`

Crea `backend\.env` automáticamente desde `deploy\windows\.env.example` con JWT y base de datos ya configurados.

### 4. Iniciar

Ejecutar: `deploy\windows\2-iniciar.bat`

### 5. URLs

| Módulo | URL |
|--------|-----|
| Login | http://localhost:8741 |
| Admin | http://localhost:8741/admin |
| Filtro | http://localhost:8741/filtro |
| Ventanilla | http://localhost:8741/ventanilla |
| TV | http://localhost:8741/tv |

Desde otros PCs en la red: `http://IP-DEL-SERVIDOR:8741/tv`

### 6. Detener base de datos

Ejecutar: `deploy\windows\3-detener.bat`

### Actualizar en el servidor

```cmd
cd C:\Apps\turnos-dispensario
git pull
npm install
npm run db:deploy
deploy\windows\2-iniciar.bat
```

---

## Reglas de negocio

1. **Un turno, un estado** — GENERADO, LLAMADO, ATENDIENDO, FINALIZADO, AUSENTE, CANCELADO
2. **Una ventanilla, un turno activo**
3. **Bloqueo transaccional** — `SELECT FOR UPDATE SKIP LOCKED`
4. **Persistencia** en PostgreSQL
5. **Auditoría completa**
6. **Máximo 3 llamados** por turno
7. **Tiempo real** con Socket.IO

## Estructura del proyecto

```
turnos-dispensario/
├── backend/           # API Express + Socket.IO + Prisma
├── frontend/          # React + Vite + Tailwind
├── deploy/windows/    # Scripts de instalación Windows
├── docker-compose.yml
└── README.md
```
