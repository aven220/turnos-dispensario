# Instalación en servidor 192.168.20.26

Configuración para un servidor Windows que **ya tiene otros programas** (PostgreSQL, etc.) sin conflictos.

## Puertos usados (solo estos)

| Servicio | Puerto | Dónde escucha | Conflicto |
|----------|--------|---------------|-----------|
| **Turnos (web)** | **8741** | Red + localhost | Poco usado; verificar con `4-verificar-puertos.bat` |
| **PostgreSQL** | **5432** | Solo `127.0.0.1` | Usa la instancia **ya instalada**; base dedicada `turnos_dispensario` |

No se instala un segundo PostgreSQL ni Docker obligatorio.

---

## Paso 1 — Configurar el proyecto

En CMD, en la carpeta del proyecto:

```cmd
cd C:\Apps\turnos-dispensario
deploy\windows\5-configurar-servidor.bat
```

Esto crea `backend\.env` con la IP **192.168.20.26** y puerto **8741**.

---

## Paso 2 — Base de datos en pgAdmin

1. **Login/Group Roles** → crear usuario:
   - Name: `turnos`
   - Password: `TdCencoic2026Disp`

2. **Databases** → crear base:
   - Database: `turnos_dispensario`
   - Owner: `turnos`

3. Query Tool (opcional):

```sql
GRANT ALL PRIVILEGES ON DATABASE turnos_dispensario TO turnos;
```

---

## Paso 3 — Instalar (una vez)

```cmd
deploy\windows\1-instalar.bat
```

Si pregunta por Docker, puede ignorarlo si ya configuró PostgreSQL en el paso 2.

Si falla la base de datos:

```cmd
npm run db:deploy
npm run db:seed
```

---

## Paso 4 — Verificar puerto libre

```cmd
deploy\windows\4-verificar-puertos.bat
```

El puerto **8741** debe estar **libre**. El 5432 puede estar ocupado por PostgreSQL (es normal).

---

## Paso 5 — Firewall Windows

Permitir solo el puerto de la aplicación:

1. Firewall de Windows → Reglas de entrada → Nueva regla
2. Puerto → TCP → **8741**
3. Permitir conexión → Red privada

No hace falta abrir el 5432 hacia la red (solo localhost).

---

## Paso 6 — Iniciar

```cmd
deploy\windows\2-iniciar.bat
```

Dejar la ventana abierta.

---

## Paso 7 — Probar

| Desde | URL |
|-------|-----|
| El mismo servidor | http://localhost:8741/api/health |
| Cualquier PC de la red | http://192.168.20.26:8741/api/health |
| Login | http://192.168.20.26:8741 |
| Pantalla TV | http://192.168.20.26:8741/tv |

Respuesta correcta:

```json
{"status":"ok","db":"connected","uptimeSeconds":...}
```

---

## Credenciales

| Usuario | Contraseña |
|---------|------------|
| admin | CencoicAdmin2026 |
| filtro | CencoicFiltro2026 |
| maria | CencoicVent2026 |

---

## Si el puerto 8741 está ocupado

Edite `backend\.env` y cambie solo la línea:

```env
PORT=8742
```

Luego use `http://192.168.20.26:8742` en todos los equipos.
