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
- **Base de datos:** PostgreSQL en **[Neon](https://neon.tech)** (plan gratuito, sin tarjeta)
- **Autenticación:** JWT

---

## Base de datos gratuita (Neon)

No se usa Docker ni servicios de pago. La base de datos vive en **Neon**, con plan free:

- Sin tarjeta de crédito
- Sin cobros por uso normal del dispensario
- Los datos persisten en la nube aunque apague el servidor Windows

### Crear la base de datos (5 minutos)

1. Entre a **https://neon.tech** y cree cuenta gratuita.
2. **New Project** → nombre: `turnos-dispensario` → región la más cercana.
3. En el panel, copie **Connection string** (pestaña *Connection details*, tipo PostgreSQL).
4. Pegue esa URL en `backend/.env` como `DATABASE_URL`.
5. Asegúrese de que termine con `?sslmode=require`. Ejemplo:

```
DATABASE_URL="postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/turnos_dispensario?sslmode=require"
```

> **Alternativa gratuita:** [Supabase](https://supabase.com) también ofrece PostgreSQL gratis. Use su *Connection string* de la misma forma.

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
| Base de datos | En la nube (Neon), sin puerto local |

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

### 1. Base de datos en Neon

Cree el proyecto en https://neon.tech y copie la connection string.

### 2. Configuración

```bash
cp backend/.env.example backend/.env
# Edite backend/.env y pegue su DATABASE_URL de Neon
```

### 3. Instalar y migrar

```bash
npm install
npm run db:deploy
npm run db:seed
```

### 4. Ejecutar

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Pantalla TV: http://localhost:5173/tv

### PostgreSQL local (opcional, solo desarrollo)

Si prefiere base de datos local sin internet:

```bash
docker compose up -d
```

Y en `backend/.env`:

```
DATABASE_URL="postgresql://turnos:TdCencoic2026Disp@127.0.0.1:5544/turnos_dispensario?schema=public"
```

---

## Producción en Windows Server

### Requisitos

- Node.js LTS 20 o 22
- Git
- Cuenta gratuita en Neon (https://neon.tech)
- **No requiere Docker**

### 1. Clonar desde GitHub

```cmd
cd C:\Apps
git clone https://github.com/TU-USUARIO/turnos-dispensario.git
cd turnos-dispensario
```

### 2. Crear base de datos en Neon

Siga los pasos de la sección **Base de datos gratuita (Neon)** arriba.

### 3. Verificar puerto libre

Ejecutar: `deploy\windows\4-verificar-puertos.bat`

### 4. Instalar (una sola vez)

Ejecutar: `deploy\windows\1-instalar.bat`

El script abre `backend\.env` para pegar la URL de Neon, luego aplica migraciones y crea usuarios.

### 5. Iniciar

Ejecutar: `deploy\windows\2-iniciar.bat`

### 6. URLs

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
├── docker-compose.yml # Opcional, solo dev local
└── README.md
```
