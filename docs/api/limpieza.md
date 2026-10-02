# API del módulo de Limpieza

Responsable del backend: **Alan**. La interfaz ya está construida y llama exactamente a estas rutas.

- Base: `/api/limpieza`. El núcleo ya exige sesión y el permiso `limpieza.ver`.
- Las reglas de validación de cada ruta ya están en `server/modulos/limpieza/limpieza.routes.js`. Al controlador solo llegan datos válidos (`datosValidos(req)`).
- Respuestas con el formato estándar: `{ ok: true, datos, mensaje? }` o `{ ok: false, mensaje, errores? }`.
- Cada cambio se registra en la bitácora con `bitacora.registrar(req, { modulo: 'limpieza', ... })`.
- Fechas `AAAA-MM-DD`, horas `HH:MM:SS`, fecha y hora `AAAA-MM-DD HH:MM:SS`.

## Estado

| Funcionalidad | Estado |
|---|---|
| Insumos: listar, crear, editar, activar/desactivar | ✅ Implementada |
| Insumos: movimientos e historial | ✅ Implementada |
| Tareas (supervisor) | ✅ Implementada |
| Mis tareas (personal) | ✅ Implementada |
| Reportes | ✅ Implementada |
| Tarjetas del inicio (`index.js → resumenDashboard`) | ✅ Implementada |

Las 17 funciones quedaron programadas. Cada cambio registra su bitácora con `modulo: 'limpieza'`.

## Permisos

| Permiso | Roles |
|---|---|
| `limpieza.ver` | Administrador, director, supervisor de limpieza, personal de limpieza |
| `limpieza.tareas.ver` | Administrador, director, supervisor |
| `limpieza.tareas.programar` | Administrador, supervisor |
| `limpieza.tareas.verificar` | Administrador, supervisor |
| `limpieza.tareas.ejecutar` | Personal de limpieza |
| `limpieza.insumos.ver` | Administrador, director, supervisor |
| `limpieza.insumos.gestionar` | Administrador, supervisor |
| `limpieza.reportes.ver` | Administrador, director, supervisor |

---

## Objeto tarea

Lo devuelven `GET /tareas`, `GET /tareas/:id` y `GET /mis-tareas`. La consulta base ya está en `tareas.model.js` (`SELECT_TAREA`).

```json
{
  "id": 4,
  "area_id": 9,
  "area": "Sanitarios entrada principal",
  "tipo_area": "sanitario",
  "tipo": "rutinaria",
  "descripcion": "Reponer papel y jabón",
  "fecha_programada": "2026-10-01",
  "hora_programada": "08:00:00",
  "asignado_id": 11,
  "asignado": "Kevin Ramírez Estrada",
  "programado_por_id": 6,
  "programado_por": "Jorge Guzmán Flores",
  "estado": "pendiente",
  "inicio_real": null,
  "fin_real": null,
  "observaciones": null,
  "verificado_por_id": null,
  "verificado_por": null,
  "fecha_verificacion": null,
  "observacion_verificacion": null,
  "atrasada": 0
}
```

`atrasada` = 1 cuando la tarea está pendiente y su fecha y hora ya pasaron.
Estados: `pendiente → en_proceso → completada → verificada | rechazada`, y `cancelada` desde pendiente o en proceso.

---

## Tareas (supervisor)

### `GET /tareas` — listar
Permiso `limpieza.tareas.ver`. Filtros opcionales: `fecha_desde`, `fecha_hasta`, `area_id`, `asignado_id`, `estado`, `tipo`.
Orden: `fecha_programada`, `hora_programada`. Devuelve un arreglo de **objetos tarea**.

### `GET /tareas/:id` — detalle
Permiso `limpieza.tareas.ver`. Devuelve un **objeto tarea** más los insumos usados:
```json
{ "...": "campos de la tarea",
  "insumos": [ { "insumo_limpieza_id": 1, "nombre": "Desinfectante", "unidad_medida": "l", "cantidad_usada": 2.0 } ] }
```
404 si no existe.

### `POST /tareas` — programar
Permiso `limpieza.tareas.programar`.
```json
{ "area_id": 9, "tipo": "rutinaria", "descripcion": "Reponer papel", "fecha_programada": "2026-10-02",
  "hora_programada": "08:00", "asignado_id": 11 }
```
Reglas:
- El área existe y está activa.
- `asignado_id` es un usuario activo con rol `personal_limpieza`. Si no, 422 en el campo `asignado_id`.
- `fecha_programada` no es anterior a hoy. Si no, 422 en el campo `fecha_programada`.
- `programado_por_id` = usuario en sesión. Estado inicial `pendiente`.

Respuesta 201: `{ "id": 9 }`.

### `PUT /tareas/:id` — editar
Mismo cuerpo y reglas que programar. Solo si la tarea está `pendiente`; si no, 409 "Solo se pueden editar tareas pendientes".

### `PATCH /tareas/:id/cancelar`
`{ "motivo": "Área cerrada por mantenimiento" }`. Solo si está `pendiente` o `en_proceso` (si no, 409). Guarda `estado = 'cancelada'` y el motivo en `observacion_verificacion`.

### `PATCH /tareas/:id/verificar`
Permiso `limpieza.tareas.verificar`.
`{ "resultado": "verificada" | "rechazada", "observacion": "Quedaron hojas en las fuentes" }`
- Solo tareas `completada`; si no, 409.
- Si `resultado` es `rechazada`, la observación es obligatoria (422 en `observacion`).
- Guarda `estado = resultado`, `verificado_por_id` = usuario en sesión, `fecha_verificacion = NOW()`, `observacion_verificacion`.

---

## Mis tareas (personal de limpieza)

Permiso `limpieza.tareas.ejecutar`. Solo puede ver y modificar **sus propias** tareas (`asignado_id = req.session.usuario.id`); con una tarea ajena responde 404.

### `GET /mis-tareas?fecha=2026-10-01`
`fecha` opcional; por defecto hoy. Devuelve **objetos tarea**:
- todas las tareas del usuario con esa `fecha_programada` (cualquier estado), y
- si la fecha consultada es hoy, además sus tareas `pendiente` o `en_proceso` de días anteriores (atrasadas).

Orden: `fecha_programada`, `hora_programada`.

### `PATCH /mis-tareas/:id/iniciar`
Solo si está `pendiente` (si no, 409). Guarda `estado = 'en_proceso'` e `inicio_real = NOW()`.

### `PATCH /mis-tareas/:id/completar`
```json
{ "observaciones": "Sin novedades",
  "insumos": [ { "insumo_limpieza_id": 1, "cantidad": 2 }, { "insumo_limpieza_id": 5, "cantidad": 3 } ] }
```
`insumos` puede venir vacío. Solo si está `en_proceso` (si no, 409). En **una transacción**:
1. Por cada insumo, verificar que esté activo y que `stock_actual >= cantidad`. Si no alcanza, 409 "No hay suficiente *nombre* (hay X)".
2. Insertar en `tarea_insumo`, insertar un movimiento `salida` con `tarea_id`, y restar del `stock_actual`.
3. Guardar `estado = 'completada'`, `fin_real = NOW()`, `observaciones`.
4. Bitácora.

---

## Insumos

### `GET /insumos` ✅
Todos los roles del módulo (el personal lo usa al completar tareas). Filtros: `buscar`, `activo` (`1`/`0`), `bajo_minimo=1`.
```json
[ { "id": 5, "nombre": "Bolsas de basura grandes", "unidad_medida": "unidad", "stock_actual": 60, "stock_minimo": 80,
    "descripcion": null, "activo": 1, "bajo_minimo": 1 } ]
```

### `POST /insumos` ✅ · `PUT /insumos/:id` ✅ · `PATCH /insumos/:id/estado` ✅
Permiso `limpieza.insumos.gestionar`. La existencia inicial (`stock_actual`) solo se recibe al crear; después cambia únicamente con movimientos.

### `GET /insumos/:id/movimientos` ✅ — historial
Permiso `limpieza.insumos.ver`. Del más reciente al más antiguo:
```json
[ { "id": 8, "tipo": "salida", "cantidad": 2.0, "tarea_id": 3, "area": "Oficinas administrativas",
    "motivo": null, "usuario": "Kevin Ramírez Estrada", "fecha": "2026-09-30 17:40:00" } ]
```
`area` es el área de la tarea (solo en salidas); `usuario` es el nombre de quien registró el movimiento.

### `POST /insumos/:id/movimientos` ✅ — entrada o merma
Permiso `limpieza.insumos.gestionar`. `{ "tipo": "entrada" | "merma", "cantidad": 10, "motivo": "Factura 1234" }`
En una transacción: inserta el movimiento y suma (entrada) o resta (merma) del `stock_actual`. Si la merma deja la existencia negativa, 409.

---

## Reportes

Permiso `limpieza.reportes.ver`. Todos reciben `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` y filtran por `fecha_programada` (tareas) o `fecha` (movimientos). Devuelven un arreglo; la interfaz calcula totales y porcentajes.

### `GET /reportes/cumplimiento`
Una fila por área que tenga tareas en el periodo:
```json
[ { "area_id": 1, "area": "Recinto de jaguares", "tipo_area": "jaula", "programadas": 10, "verificadas": 7,
    "completadas": 1, "rechazadas": 1, "pendientes": 1, "canceladas": 0 } ]
```
`programadas` = todas; cada estado cuenta aparte; `pendientes` incluye `pendiente` y `en_proceso`.

### `GET /reportes/consumo-insumos`
Una fila por insumo activo:
```json
[ { "insumo_limpieza_id": 5, "nombre": "Bolsas de basura grandes", "unidad_medida": "unidad",
    "entradas": 69, "salidas": 9, "mermas": 0, "stock_actual": 60, "stock_minimo": 80 } ]
```

### `GET /reportes/personal`
Una fila por persona con rol `personal_limpieza` que tuvo tareas en el periodo:
```json
[ { "usuario_id": 7, "nombre": "Luis Martínez Cruz", "asignadas": 12, "completadas": 2, "verificadas": 8,
    "rechazadas": 1, "minutos_promedio": 42.5 } ]
```
`minutos_promedio` = promedio de `TIMESTAMPDIFF(MINUTE, inicio_real, fin_real)` de las tareas terminadas.

---

## Tarjetas del inicio (`resumenDashboard` en `index.js`)

Según el permiso de quien entra:

| Permiso | Tarjeta sugerida |
|---|---|
| `limpieza.tareas.ejecutar` | "Mis tareas de hoy" (pendientes o en proceso), url `/app/limpieza/mis-tareas.html` |
| `limpieza.tareas.verificar` | "Tareas por verificar" (estado `completada`), color `alerta`, url `/app/limpieza/tareas.html` |
| `limpieza.insumos.ver` | "Insumos bajo el mínimo", color `peligro` si hay alguno, url `/app/limpieza/insumos.html?bajo_minimo=1` |

Formato de cada tarjeta: `{ titulo, valor, icono: 'bi-...', color: 'primary' | 'alerta' | 'peligro' | 'neutro', url }`.
