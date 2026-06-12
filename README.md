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
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT

## Inicio rápido

### 1. Base de datos

```bash
docker compose up -d
```

PostgreSQL queda en `localhost:5433`.

### 2. Configuración

```bash
cp backend/.env.example backend/.env
```

Ajuste `DATABASE_URL` si es necesario:

```
postgresql://turnos:turnos123@localhost:5433/turnos_dispensario?schema=public
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

## Usuarios de prueba

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| filtro | filtro123 | Filtro |
| maria | ventanilla123 | Ventanilla 1 |
| juan | ventanilla123 | Ventanilla 2 |
| carlos | ventanilla123 | Ventanilla 3 |

> Los operadores de ventanilla deben seleccionar su ventanilla al iniciar sesión.

## Reglas de negocio implementadas

1. **Un turno, un estado** — Estados: GENERADO, LLAMADO, ATENDIENDO, FINALIZADO, AUSENTE, CANCELADO
2. **Una ventanilla, un turno activo** — No permite múltiples turnos simultáneos
3. **Bloqueo transaccional** — `SELECT FOR UPDATE SKIP LOCKED` al tomar siguiente turno
4. **Persistencia** — Estado conservado en PostgreSQL ante cierres inesperados
5. **Historial permanente** — Sin eliminación de registros
6. **Auditoría completa** — Usuario, acción, fecha, ventanilla, IP
7. **Máximo 3 llamados** — Luego permite marcar ausente
8. **Asignación automática** — Solo botón "Tomar siguiente"
9. **Tiempo real** — Socket.IO en TV, admin, ventanilla y filtro

## Motor de asignación

Cada ventanilla atiende las prioridades configuradas. Al presionar "Tomar siguiente", el sistema busca el turno más antiguo en estado GENERADO, respetando el orden de prioridad (nivel 1 primero).

## Exportación

Desde el panel administrador:

- **Excel** — Detalle completo de atención
- **PDF** — Resumen ejecutivo con totales y ranking

## Estructura del proyecto

```
turnos-dispensario/
├── backend/          # API Express + Socket.IO + Prisma
├── frontend/         # React + Vite + Tailwind
├── docker-compose.yml
└── README.md
```
