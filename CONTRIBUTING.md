# Guía para el equipo

Cómo trabajar tu módulo sin chocar con los demás.

## 1. Ramas

| Rama | Uso |
|---|---|
| `main` | Versión estable, la que se presenta. Nadie trabaja directo aquí. |
| `develop` | Integración. Aquí se juntan los módulos terminados. |
| `feature/alimentacion` | Mijeli |
| `feature/limpieza` | Alan |
| `feature/clinico` | Daniela |
| `feature/entradas` | Mario |
| `feature/base-datos` | Cambios a la base de datos compartida |

```bash
git checkout develop
git pull
git checkout feature/limpieza        # tu rama
git merge develop                    # trae lo último de develop a tu rama

# ...trabajas...
git add .
git commit -m "feat(limpieza): registrar tareas de limpieza"
git push
```

Cuando una parte funcione, abre un **Pull Request de tu rama hacia `develop`** en GitHub. Antes de abrirlo, vuelve a hacer `git merge develop` en tu rama y comprueba que todo arranca con `npm run dev`.

## 2. Mensajes de commit (Conventional Commits)

Todos los commits siguen la especificación [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).

```
<tipo>(<alcance>): <descripción>
```

**Tipos**

| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Agregas una funcionalidad nueva |
| `fix` | Corriges un error |
| `docs` | Solo cambias documentación (README, comentarios, guías) |
| `style` | Cambias formato del código sin alterar su comportamiento (espacios, comas) |
| `refactor` | Reorganizas código sin agregar funciones ni corregir errores |
| `perf` | Mejoras el rendimiento |
| `test` | Agregas o corriges pruebas |
| `build` | Cambias dependencias o la configuración de Docker o npm |
| `chore` | Tareas de mantenimiento que no tocan el código de la app |

**Alcances**

| Alcance | Corresponde a |
|---|---|
| `core` | Núcleo general (app.js, middlewares, utilidades) |
| `auth` | Inicio de sesión, contraseñas, sesiones |
| `usuarios` | Administración de usuarios |
| `bitacora` | Bitácora |
| `ui` | Estilos y scripts comunes del frontend |
| `portal` | Portal público de visitantes |
| `alimentacion` | Módulo de Mijeli |
| `limpieza` | Módulo de Alan |
| `clinico` | Módulo de Daniela |
| `entradas` | Módulo de Mario |
| `db` | Scripts SQL y modelo de datos |
| `docker` | docker-compose y contenedores |

**Reglas de la descripción**

- En español, en modo imperativo y en minúscula: *agregar*, *corregir*, *actualizar* (no *agregué* ni *agregando*).
- Sin punto final y de preferencia en menos de 72 caracteres.
- Si el cambio necesita explicación, deja una línea en blanco y escribe el cuerpo debajo.
- Si el cambio rompe algo que otros usan (por ejemplo, renombrar una tabla compartida), agrega `!` después del alcance y una línea `BREAKING CHANGE:` en el cuerpo.

**Ejemplos**

```
feat(clinico): agregar registro de vacunas por animal
fix(entradas): corregir cálculo de descuento en promociones
feat(alimentacion): descontar inventario al registrar una ración
docs(limpieza): documentar rutas de la API del módulo
refactor(alimentacion): separar consultas de lotes en su propio modelo
build(docker): fijar versión de MySQL 8.0
feat(db)!: renombrar tabla area a recinto

BREAKING CHANGE: los módulos que usan la tabla area deben actualizar sus consultas
```

Para un commit con cuerpo desde la terminal, usa varios `-m`:

```bash
git commit -m "fix(auth): cerrar sesiones al desactivar un usuario" -m "Antes el usuario seguía navegando hasta que expiraba su sesión."
```

Los títulos de los Pull Requests siguen el mismo formato.

## 3. Qué archivos toca cada quien

Cada módulo vive en **sus propias carpetas**. Si solo tocas las tuyas, no habrá conflictos.

```
server/modulos/<tu-modulo>/          Backend de tu módulo
public/app/<tu-modulo>/              Páginas HTML de tu módulo
public/assets/js/modulos/<tu-modulo>/   JavaScript de tus páginas
database/<NN>_<tu-modulo>.sql        Tablas y datos de prueba de tu módulo (ya creadas)
```

| Módulo | Carpeta | Archivo SQL |
|---|---|---|
| Limpieza | `limpieza` | `database/10_limpieza.sql` |
| Alimentación | `alimentacion` | `database/20_alimentacion.sql` |
| Control Clínico | `clinico` | `database/30_clinico.sql` |
| Entradas y Promociones | `entradas` | `database/40_entradas.sql` |

**No modifiques** `server/app.js`, `server/core/`, `server/middlewares/`, `public/assets/js/core/` ni `public/assets/css/zoo.css`. Si necesitas algo del núcleo, avísale a Mijeli para agregarlo en `develop` y que todos lo reciban.

## 4. Cómo funciona un módulo

El servidor carga automáticamente cada carpeta de `server/modulos/`. Tu `index.js` declara:

- **permisos**: qué roles pueden hacer qué. Formato `modulo.recurso.accion`, por ejemplo `clinico.vacunas.registrar`. El permiso `<modulo>.ver` es obligatorio.
- **menu**: los enlaces que aparecen en la barra lateral, cada uno con su permiso.
- **router**: las rutas de tu API. Se montan en `/api/<modulo>` y ya exigen sesión y el permiso `<modulo>.ver`.
- **routerPublico** (opcional): rutas sin sesión en `/api/publico/<modulo>`. Solo lo usa Entradas para el portal de visitantes.
- **resumenDashboard** (opcional): tarjetas que aparecen en el inicio.

Para proteger una acción específica dentro de tu router:

```js
const { requierePermiso } = require('../../middlewares/auth');
router.post('/vacunas', requierePermiso('clinico.vacunas.registrar'), controlador.registrar);
```

Las páginas de `public/app/<modulo>/` quedan protegidas solas: si están en el menú usan el permiso del enlace, y si no, exigen `<modulo>.ver`.

## 5. Capas del backend (MVC)

| Archivo | Responsabilidad |
|---|---|
| `<recurso>.routes.js` | Define las rutas y las reglas de validación |
| `<recurso>.controller.js` | Recibe la petición, aplica reglas de negocio, registra la bitácora y responde |
| `<recurso>.model.js` | Solo consultas SQL |

Como ejemplo completo puedes ver `server/core/usuarios/`.

## 6. Reglas obligatorias

1. **SQL siempre con `?`**. Nunca concatenes valores del usuario en una consulta.
   ```js
   db.query('SELECT * FROM vacuna WHERE animal_id = ?', [animalId]);   // bien
   db.query(`SELECT * FROM vacuna WHERE animal_id = ${animalId}`);     // NUNCA
   ```
2. **Valida en el servidor** con `validar([...])` en cada ruta que recibe datos.
3. **Registra en la bitácora** cada creación, modificación o eliminación con `bitacora.registrar(...)`.
4. **Escapa los datos al pintarlos** en HTML con `Zoo.ui.esc(...)`.
5. **Usa transacciones** (`db.transaccion`) cuando una operación modifica varias tablas.
6. **Sin `<script>` ni `onclick` dentro del HTML**. La política de seguridad los bloquea; todo el JavaScript va en archivos `.js` y los eventos con `addEventListener`.
7. **Responde con el formato estándar** usando `ok(res, datos)` o `creado(res, datos)`, y los errores con `throw new AppError(...)`.

## 7. Herramientas compartidas

### Frontend (objeto global `Zoo`)

| Herramienta | Uso |
|---|---|
| `Zoo.listo(fn)` | Punto de inicio del JS de tu página (ya validó la sesión) |
| `Zoo.sesion.puede('permiso')` | Muestra u oculta botones según el rol |
| `Zoo.api.get/post/put/patch/del` | Llamadas al servidor |
| `Zoo.ui.*` | Notificaciones, confirmaciones, formularios, tablas y formatos |
| `Zoo.etiquetas.*` | Texto y color de los valores de la BD (`en_tratamiento` → "En tratamiento"). Agrega los de tu módulo con `Zoo.etiquetas.agregar(...)` |
| `Zoo.crud({...})` | Pantalla estándar de registro: filtros, tabla, formulario en ventana y activar o desactivar |
| `Zoo.reportes.pdf/excel` | Exportar reportes |

Ejemplos: `paginas/catalogos/habitats.js` (registro simple con `Zoo.crud`), `paginas/catalogos/animales.js` (registro con ficha y exportación) y `paginas/admin/bitacora.js` (reporte paginado).

### Datos para los selectores (`/api/comun`)

Solo requieren sesión y devuelven registros activos. Úsalos en lugar de crear tus propias consultas:

| Ruta | Devuelve |
|---|---|
| `GET /api/comun/animales?area_id=&especie_id=` | Animales en el zoológico |
| `GET /api/comun/especies` | Especies |
| `GET /api/comun/habitats` | Hábitats |
| `GET /api/comun/areas?tipo=jaula` | Áreas; acepta varios tipos: `tipo=sanitario,jardin` |
| `GET /api/comun/usuarios?roles=cuidador` | Personal activo de uno o varios roles |
| `GET /api/comun/veterinarios` | Veterinarios con su número de colegiado |

### Backend

- `server/utils/reglas.js`: reglas de validación con mensajes uniformes (`r.texto`, `r.id`, `r.decimal`, `r.fecha`, `r.hora`, `r.enumerado`, etc.). Los campos opcionales vacíos llegan como `null`.
- `server/core/bitacora/bitacora.service.js`: `bitacora.registrar(req, {...})`.
- `server/config/db.js`: `db.query`, `db.queryUno` y `db.transaccion`.

## 8. Base de datos

**Las tablas de todos los módulos ya están creadas** en `database/`, con datos de prueba. Revisa las de tu módulo antes de programar; los comentarios de cada tabla explican el flujo y las reglas.

Convenciones (respétalas si agregas algo):

- Tablas en singular y minúscula: `registro_alimentacion`.
- Llave primaria `id`; llave foránea `<tabla>_id`: `especie_id`, `usuario_id`.
- `creado_en` y `actualizado_en` para fechas de control.
- Los catálogos no se borran: se desactivan con `activo = 0`.
- Cantidades con `DECIMAL`, nunca `FLOAT`. Estados con `ENUM`.
- Reglas importantes como `CHECK` en la tabla (existencias no negativas, fechas coherentes).

Las tablas compartidas (`usuario`, `veterinario`, `habitat`, `area`, `especie`, `animal`) están en `01_core.sql`. **No las modifiques en tu rama**: si necesitas un cambio, avísale a Mijeli.

Si necesitas cambiar una tabla de tu módulo:

1. Edita tu archivo SQL.
2. Ejecuta `npm run db:reset` para recrear la BD.
3. Avisa al equipo en el Pull Request, porque todos tendrán que hacer `npm run db:reset` al recibir tu cambio.
4. Si el cambio afecta el diagrama, actualiza también `docs/modelo-er.dbml`.

## 9. Interfaz ya construida y backend pendiente

La interfaz de cada módulo se construye en el núcleo para que todo el sistema se vea igual. A cada responsable le toca **programar el backend** siguiendo el contrato de su módulo:

| Módulo | Contrato de la API |
|---|---|
| Limpieza | [`docs/api/limpieza.md`](docs/api/limpieza.md) |
| Control Clínico | [`docs/api/clinico.md`](docs/api/clinico.md) |
| Entradas y Promociones | [`docs/api/entradas.md`](docs/api/entradas.md) |

Cómo trabajar:

1. Lee el contrato de tu módulo: dice qué recibe cada ruta, qué reglas aplica y qué devuelve exactamente.
2. Las rutas y sus validaciones ya existen en `server/modulos/<modulo>/<modulo>.routes.js`.
3. Cada función pendiente del controlador tiene una línea `pendiente('...')` y comentarios con lo que debe hacer. Bórrala y programa la lógica.
4. Mientras una función no esté lista, la pantalla muestra un aviso "En construcción" en lugar de fallar.
5. **No cambies los nombres de los campos** que define el contrato: la interfaz los espera así. Si necesitas un cambio, avísale a Mijeli.
6. Tienes un ejemplo completo en tu propio módulo para copiar el estilo (Limpieza: insumos; Clínico: inventario; Entradas: tipos de entrada y promociones).
