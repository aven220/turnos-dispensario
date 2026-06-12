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
- **Base de datos:** PostgreSQL **local** (gratis, sin suscripciones)
- **Autenticación:** JWT

---

## ¿Se puede usar XAMPP?

**No directamente.** XAMPP trae **MySQL/MariaDB**, pero este proyecto usa **PostgreSQL**. Son motores distintos; usar XAMPP implicaría reescribir toda la base de datos.

### Opciones locales gratuitas (recomendadas)

| Opción | Dificultad | ¿Funciona? | Suscripciones |
|--------|------------|------------|---------------|
| **Docker + PostgreSQL** | Fácil | Sí | Ninguna |
| **PostgreSQL en Windows** | Media | Sí | Ninguna |
| XAMPP (MySQL) | — | No | — |
| Neon (nube) | Fácil | Sí (opcional) | Plan free |

**Recomendación:** use **Docker Desktop** (opción más simple) o **PostgreSQL instalado en Windows** si no quiere Docker. Ambas son 100 % locales y gratuitas.

---

## Base de datos local (recomendado)

### Opción A — Docker (más fácil)

1. Instale [Docker Desktop](https://www.docker.com/products/docker-desktop/) (gratis).
2. En la carpeta del proyecto:

```cmd
docker compose up -d
```

PostgreSQL queda en `127.0.0.1:5544` — solo este equipo, no interfiere con otros programas.

### Opción B — PostgreSQL en Windows (sin Docker)

1. Descargue el instalador: https://www.postgresql.org/download/windows/
2. Durante la instalación:
   - Puerto: **5544** (poco usado, evita conflictos)
   - Contraseña del superusuario: anótela
3. Abra **pgAdmin** o **SQL Shell (psql)** y ejecute:

```sql
CREATE USER turnos WITH PASSWORD 'TdCencoic2026Disp';
CREATE DATABASE turnos_dispensario OWNER turnos;
GRANT ALL PRIVILEGES ON DATABASE turnos_dispensario TO turnos;
```

4. En `backend/.env`:

```
DATABASE_URL="postgresql://turnos:TdCencoic2026Disp@127.0.0.1:5544/turnos_dispensario?schema=public"
```

### Opción C — Nube gratis (opcional, si no quiere nada local)

[Neon](https://neon.tech) ofrece PostgreSQL gratis (sin tarjeta). Pegue la connection string en `DATABASE_URL` con `?sslmode=require` al final.

---

## Credenciales del sistema

> Guarde este bloque. Si el repositorio es público, cambie las contraseñas de la aplicación.

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

### Puertos en el servidor Windows

| Servicio | Puerto |
|----------|--------|
| Aplicación (web + API + TV) | **8741** |
| PostgreSQL local | **5544** (solo `127.0.0.1`) |

### PostgreSQL local (Docker o instalado)

| Campo | Valor |
|-------|-------|
| Usuario | `turnos` |
| Contraseña | `TdCencoic2026Disp` |
| Base de datos | `turnos_dispensario` |

---

## Subir a GitHub

```bash
cd turnos-dispensario
git remote add origin https://github.com/TU-USUARIO/turnos-dispensario.git
git push -u origin main
```

El archivo `backend/.env` **no** se sube. La plantilla está en `deploy/windows/.env.example`.

---

## Desarrollo local (Mac / Linux)

```bash
docker compose up -d
cp backend/.env.example backend/.env
npm install
npm run db:deploy
npm run db:seed
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
- **Docker Desktop** (recomendado) o **PostgreSQL para Windows**

### 1. Clonar desde GitHub

```cmd
cd C:\Apps
git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
```

### 2. Verificar puerto libre

Ejecutar: `deploy\windows\4-verificar-puertos.bat`

### 3. Instalar (una sola vez)

Ejecutar: `deploy\windows\1-instalar.bat`

Si tiene Docker, levanta PostgreSQL local automáticamente. Si no, siga **Opción B** de base de datos local arriba.

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
4. **Persistencia** en PostgreSQL (Neon)
5. **Auditoría completa**
6. **Máximo 3 llamados** por turno
7. **Tiempo real** con Socket.IO

## Estructura del proyecto

```
turnos-dispensario/
├── backend/           # API Express + Socket.IO + Prisma
├── frontend/          # React + Vite + Tailwind
├── deploy/windows/    # Scripts de instalación Windows
├── docker-compose.yml # PostgreSQL local (gratis)
└── README.md
```
