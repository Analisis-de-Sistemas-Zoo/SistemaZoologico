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
| `feature/base-datos` | Emilio |

```bash
git checkout develop
git pull
git checkout feature/limpieza        # tu rama
git merge develop                    # trae lo último de develop a tu rama

# ...trabajas...
git add .
git commit -m "limpieza: registrar tareas de limpieza"
git push
```

Cuando una parte funcione, abre un **Pull Request de tu rama hacia `develop`** en GitHub. Antes de abrirlo, vuelve a hacer `git merge develop` en tu rama y comprueba que todo arranca con `npm run dev`.

Mensajes de commit: `modulo: qué hiciste`, en presente. Ejemplos: `clinico: agregar registro de vacunas`, `entradas: corregir cálculo de descuento`.

## 2. Qué archivos toca cada quien

Cada módulo vive en **sus propias carpetas**. Si solo tocas las tuyas, no habrá conflictos.

```
server/modulos/<tu-modulo>/          Backend de tu módulo
public/app/<tu-modulo>/              Páginas HTML de tu módulo
public/assets/js/modulos/<tu-modulo>/   JavaScript de tus páginas
database/<NN>_<tu-modulo>.sql        Tablas y datos de prueba de tu módulo
```

| Módulo | Carpeta | Archivo SQL |
|---|---|---|
| Limpieza | `limpieza` | `database/10_limpieza.sql` |
| Alimentación | `alimentacion` | `database/20_alimentacion.sql` |
| Control Clínico | `clinico` | `database/30_clinico.sql` |
| Entradas y Promociones | `entradas` | `database/40_entradas.sql` |

**No modifiques** `server/app.js`, `server/core/`, `server/middlewares/`, `public/assets/js/core/` ni `public/assets/css/zoo.css`. Si necesitas algo del núcleo, avísale a Mijeli para hacerlo en una rama aparte y que todos lo reciban.

## 3. Cómo funciona un módulo

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

## 4. Capas del backend (MVC)

| Archivo | Responsabilidad |
|---|---|
| `<recurso>.routes.js` | Define las rutas y las reglas de validación |
| `<recurso>.controller.js` | Recibe la petición, aplica reglas de negocio, registra la bitácora y responde |
| `<recurso>.model.js` | Solo consultas SQL |

Como ejemplo completo puedes ver `server/core/usuarios/`.

## 5. Reglas obligatorias

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

## 6. Herramientas del frontend

Cargadas en todas las páginas internas, en el objeto global `Zoo`:

| Herramienta | Uso |
|---|---|
| `Zoo.listo(fn)` | Punto de inicio del JS de tu página (ya validó la sesión) |
| `Zoo.sesion.puede('permiso')` | Muestra u oculta botones según el rol |
| `Zoo.api.get/post/put/patch/del` | Llamadas al servidor |
| `Zoo.ui.*` | Notificaciones, confirmaciones, formularios, tablas y formatos |
| `Zoo.reportes.pdf/excel` | Exportar reportes |

Como ejemplos puedes ver `public/assets/js/paginas/admin/usuarios.js` (pantalla de registro) y `bitacora.js` (pantalla de reporte).

## 7. Base de datos

- Tus tablas van en tu archivo SQL. Puedes usar llaves foráneas hacia las tablas del núcleo (`usuario`, etc.).
- Incluye datos de prueba al final de tu archivo para que el módulo se vea con información en la presentación.
- Después de cambiar un `.sql`, corre `npm run db:reset`.
- Nombres de tablas y columnas en minúsculas y singular, separados por guion bajo: `registro_alimentacion`, `fecha_vencimiento`.
