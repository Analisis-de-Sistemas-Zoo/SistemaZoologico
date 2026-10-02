# Cómo desplegar el proyecto

Instrucciones cortas para levantar el sistema en una máquina nueva.

## 1. Requisitos

- [Node.js 20 o superior](https://nodejs.org/) — verificar con `node -v`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — en Windows requiere WSL2

## 2. Pasos

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd SistemaZoologico

# 2. Instalar dependencias
npm install

# 3. Crear la configuración
copy .env.example .env          # En Linux/Mac:  cp .env.example .env

# 4. Levantar MySQL y Adminer (crea las tablas y los datos de prueba)
npm run db:up

# 5. Levantar la aplicación
npm run dev                     # Con recarga automática al guardar
                               # Para producción usa:  npm start
```

La primera vez MySQL tarda entre 20 y 30 segundos. El servidor espera y reintenta solo, así que no hay que hacer nada más.

## 3. Puertos

| Dirección | Qué es |
|---|---|
| **http://localhost:3000** | **Portal público (entra aquí)** |
| http://localhost:3000/login.html | Acceso del personal |
| http://localhost:8081 | Adminer (base de datos) |

Para Adminer: servidor `mysql`, usuario `zoo_app`, contraseña `zoo_app_2026`, base `zoologico_mirada_salvaje`.

El puerto de la aplicación se cambia en `.env` (`PORT=3000`).

## 4. Entrar

Todos los usuarios de prueba usan la contraseña **`Zoo2026!`**

| Usuario | Rol |
|---|---|
| `admin` | Administrador (ve todo) |
| `director` | Director |
| `veterinario` | Veterinario |
| `cuidador` | Cuidador |
| `bodega` | Encargado de bodega |
| `suplimpieza` | Supervisor de limpieza |
| `limpieza` | Personal de limpieza |
| `taquilla` | Taquillero |

## 5. Comandos

| Comando | Para qué sirve |
|---|---|
| `npm run dev` | Levanta el servidor y reinicia al guardar cambios |
| `npm start` | Levanta el servidor sin recarga automática |
| `npm run db:up` | Levanta MySQL y Adminer |
| `npm run db:down` | Detiene los contenedores (los datos se conservan) |
| `npm run db:reset` | **Borra la base** y la recrea desde `/database` |
| `npm run db:logs` | Muestra el registro de MySQL |
| `npm test` | Corre las pruebas (con el servidor y la base arriba) |
| `npm test -- --lectura` | Solo las pruebas que no escriben en la base |

## 6. Antes de presentar

```bash
npm run db:reset     # Base limpia con los datos de prueba del día
npm run db:up        # (db:reset ya levanta los contenedores)
npm start            # Levanta la aplicación
```

## 7. Problemas frecuentes

**"Cannot connect to MySQL"** — la base no está lista o no está levantada:

```bash
npm run db:logs      # ver qué dice MySQL
npm run db:up        # volver a levantarla
```

**"Access denied for user"** — el `.env` no coincide con `docker-compose.yml`. Copia de nuevo `.env.example` a `.env`.

**El puerto 3000 está ocupado** — cambia `PORT=3001` en `.env` y entra por `http://localhost:3001`.

**Faltan tablas o los datos están desactualizados** — los scripts de `/database` solo corren al crear la base por primera vez:

```bash
npm run db:reset
```

**Docker no encuentra la imagen** — reinicia Docker Desktop y vuelve a correr `npm run db:up`.

---

Ver el detalle técnico del proyecto en [README.md](README.md).
