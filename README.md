# Sistema de control del zoológico "Mirada Salvaje"

Prototipo del proyecto del curso **Análisis de Sistemas II** — Universidad Mariano Gálvez de Guatemala, Campus Jutiapa.

Aplicación web con un **portal público** para visitantes (promociones y compra de entradas, sin iniciar sesión) y un **sistema interno** para el personal, con acceso por roles a cuatro módulos.

| Módulo | Responsable | Estado |
|---|---|---|
| Núcleo (autenticación, roles, usuarios, bitácora) | Mijeli | Listo |
| Gestión de Alimentación | Mijeli | Pendiente |
| Gestión de Limpieza | Alan | Pendiente |
| Control Clínico | Daniela | Pendiente |
| Gestión de Entradas y Promociones | Mario | Pendiente |
| Base de datos (modelo entidad-relación) | Emilio | En revisión |

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (sin frameworks), Bootstrap 5, Bootstrap Icons |
| Reportes | jsPDF + AutoTable (PDF) y ExcelJS (Excel), generados en el navegador |
| Backend | Node.js 20+ con Express 5 (arquitectura por capas, patrón MVC) |
| Base de datos | MySQL 8 en Docker, con Adminer para administrarla |
| Seguridad | Sesiones en BD con cookie httpOnly, bcrypt, Helmet (CSP), límite de intentos, bloqueo de cuentas, consultas parametrizadas, validación con express-validator, bitácora |

Todas las librerías del navegador se sirven desde `node_modules`, así que **la app funciona sin internet** el día de la presentación.

---

## Requisitos

- [Node.js 20 o superior](https://nodejs.org/) (`node -v`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (en Windows requiere WSL2)
- Git

## Instalación (primera vez)

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd zoologico-mirada-salvaje

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de configuración
cp .env.example .env          # En Windows (CMD):  copy .env.example .env

# 4. Levantar MySQL y Adminer (la primera vez crea las tablas y los datos de prueba)
npm run db:up

# 5. Iniciar el servidor (se reinicia solo al guardar cambios)
npm run dev
```

Abre <http://localhost:3000>. La primera vez MySQL tarda unos 20 a 30 segundos en quedar listo; el servidor espera y reintenta solo.

| Dirección | Qué es |
|---|---|
| <http://localhost:3000> | Portal público para visitantes |
| <http://localhost:3000/login.html> | Acceso del personal |
| <http://localhost:8081> | Adminer (servidor `mysql`, usuario `zoo_app`, contraseña `zoo_app_2026`, base `zoologico_mirada_salvaje`) |

## Usuarios de prueba

Todos usan la contraseña **`Zoo2026!`**

| Usuario | Rol |
|---|---|
| `admin` | Administrador |
| `director` | Director |
| `veterinario` | Veterinario |
| `cuidador` | Cuidador |
| `bodega` | Encargado de bodega |
| `suplimpieza` | Supervisor de limpieza |
| `limpieza` | Personal de limpieza |
| `taquilla` | Taquillero |

## Comandos

| Comando | Para qué sirve |
|---|---|
| `npm run dev` | Inicia el servidor y lo reinicia al guardar cambios |
| `npm start` | Inicia el servidor sin recarga automática |
| `npm run db:up` | Levanta MySQL y Adminer |
| `npm run db:down` | Detiene los contenedores (los datos se conservan) |
| `npm run db:reset` | **Borra la BD** y la vuelve a crear con los scripts de `/database` |
| `npm run db:logs` | Muestra el registro de MySQL |
| `npm run hash -- "Clave123"` | Genera el hash bcrypt de una contraseña (para scripts SQL) |

> Los scripts de `/database` solo se ejecutan cuando la BD se crea por primera vez. Si alguien cambia un `.sql`, todos deben correr `npm run db:reset`.

## Sin Docker (alternativa)

1. Instala MySQL 8 y crea la base y el usuario:
   ```sql
   CREATE DATABASE zoologico_mirada_salvaje CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'zoo_app'@'localhost' IDENTIFIED BY 'zoo_app_2026';
   GRANT ALL PRIVILEGES ON zoologico_mirada_salvaje.* TO 'zoo_app'@'localhost';
   ```
2. Ejecuta en orden los archivos de `/database` sobre esa base.
3. En `.env` cambia `DB_PORT=3306`.

---

## Estructura del proyecto

```
zoologico-mirada-salvaje/
├── server/                      Backend (Node.js + Express)
│   ├── app.js                   Arranque: seguridad, sesiones, rutas, archivos
│   ├── config/
│   │   ├── env.js               Lee el archivo .env
│   │   ├── db.js                Conexión a MySQL (query, queryUno, transaccion)
│   │   └── permisos.js          Roles, permisos y menú del núcleo
│   ├── middlewares/             auth (sesión y permisos), csrf, validar, errores
│   ├── core/                    Funciones compartidas
│   │   ├── acceso.js            Une permisos y menús de todos los módulos
│   │   ├── sesion-store.js      Sesiones guardadas en MySQL
│   │   ├── auth/                Login, logout, cambio de contraseña, bloqueo
│   │   ├── usuarios/            Administración de usuarios (modelo, controlador, rutas)
│   │   ├── bitacora/            Servicio y consulta de la bitácora
│   │   └── dashboard/           Resumen del inicio
│   ├── modulos/                 Un módulo por carpeta (se cargan solos)
│   │   └── index.js             Cargador automático y contrato de cada módulo
│   └── utils/                   AppError, respuesta, generar-hash
├── public/                      Frontend
│   ├── index.html               Portal público (sin sesión)
│   ├── login.html               Acceso del personal
│   ├── 403.html  404.html
│   ├── app/                     Páginas protegidas (el servidor exige sesión y permiso)
│   │   ├── dashboard.html  perfil.html
│   │   └── admin/               usuarios.html  bitacora.html
│   └── assets/
│       ├── css/                 zoo.css (identidad y app interna), publico.css
│       ├── img/                 logo e ilustraciones
│       └── js/
│           ├── core/            api.js, ui.js, layout.js, reportes.js
│           ├── paginas/         JS de las páginas del núcleo
│           └── publico/         JS del portal y del login
├── database/                    Scripts SQL (se ejecutan en orden alfabético)
│   ├── 01_core.sql              Tablas del núcleo
│   └── 02_core_seed.sql         Roles y usuarios de prueba
├── docker-compose.yml           MySQL 8 + Adminer
└── .env.example                 Plantilla de configuración
```

## Seguridad implementada

- **Autenticación** con usuario o correo y contraseña cifrada con bcrypt.
- **Bloqueo temporal** de la cuenta por 15 minutos tras 5 intentos fallidos, y límite de 20 intentos por IP cada 15 minutos.
- **Sesiones** guardadas en MySQL, con cookie `httpOnly` y `SameSite=Strict`, expiración por inactividad (120 min) y regeneración del identificador al iniciar sesión.
- **Control de acceso por roles** en el servidor, tanto para la API como para cada página de `/app`. El menú se arma según el rol, pero la protección real está en el servidor.
- **Revalidación del usuario** en cada petición: si el administrador lo desactiva, pierde el acceso de inmediato.
- **Protección CSRF** con cabecera obligatoria en peticiones que modifican datos.
- **Cabeceras de seguridad** con Helmet, incluida una política de contenido (CSP) que bloquea scripts externos e inyectados.
- **Prevención de inyección SQL** con consultas parametrizadas y de XSS escapando todo dato antes de mostrarlo.
- **Validación** de todos los datos de entrada en el servidor.
- **Bitácora** de inicios de sesión, intentos fallidos, bloqueos, accesos denegados y todo cambio de datos, con usuario, fecha, hora e IP.

---

## Para el equipo

Las instrucciones para trabajar cada módulo en su rama están en **[CONTRIBUTING.md](CONTRIBUTING.md)**.
