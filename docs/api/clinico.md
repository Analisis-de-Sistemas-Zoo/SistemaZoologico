# API del módulo de Control Clínico

Responsable del backend: **Daniela**. La interfaz ya está construida y llama exactamente a estas rutas.

- Base: `/api/clinico`. El núcleo ya exige sesión y el permiso `clinico.ver`.
- Las reglas de validación ya están en `server/modulos/clinico/clinico.routes.js`. Al controlador solo llegan datos válidos (`datosValidos(req)`).
- Las consultas base (`SELECT_EXPEDIENTE`, `SELECT_CONSULTA`, `SELECT_APLICACION` y la condición de dosis pendientes) ya están en `clinico.model.js`.
- Respuestas con el formato estándar: `{ ok: true, datos, mensaje? }` o `{ ok: false, mensaje, errores? }`.
- Cada cambio se registra en la bitácora (`modulo: 'clinico'`).
- Fechas `AAAA-MM-DD`; fecha y hora `AAAA-MM-DD HH:MM:SS` (las reglas ya convierten el valor de `datetime-local`).

## Estado

| Funcionalidad | Estado |
|---|---|
| Inventario: listar, crear, editar, activar/desactivar | ✅ Implementada (ejemplo) |
| Inventario: movimientos e historial | ⏳ Pendiente |
| Expedientes | ⏳ Pendiente |
| Consultas | ⏳ Pendiente |
| Aplicaciones y dosis pendientes | ⏳ Pendiente |
| Reportes | ⏳ Pendiente |
| Tarjetas del inicio (`index.js → resumenDashboard`) | ⏳ Pendiente |

## Permisos

| Permiso | Roles |
|---|---|
| `clinico.ver` | Administrador, director, veterinario |
| `clinico.registrar` | Veterinario (consultas y aplicaciones) |
| `clinico.inventario.gestionar` | Administrador, veterinario |
| `clinico.reportes.ver` | Administrador, director, veterinario |

El veterinario de una consulta o aplicación es siempre el usuario en sesión (`req.session.usuario.id`), que existe en la tabla `veterinario`.

---

## Objetos

### Objeto consulta (`SELECT_CONSULTA`)
```json
{ "id": 1, "animal_id": 9, "animal_codigo": "ANI-0009", "animal": "Simba", "especie": "León",
  "veterinario_id": 3, "veterinario": "Patricia Ortiz Ramírez",
  "fecha": "2026-09-24 09:30:00", "tipo": "emergencia", "motivo": "Pérdida de apetito y vómito",
  "sintomas": "Vómito en dos ocasiones", "diagnostico": "Gastroenteritis bacteriana",
  "tratamiento": "Metronidazol por 10 días", "peso_kg": 188.0, "temperatura_c": 39.4,
  "estado_salud_resultante": "en_tratamiento", "proxima_revision": "2026-10-04", "observaciones": null }
```

### Objeto aplicación (`SELECT_APLICACION`)
```json
{ "id": 1, "animal_id": 9, "animal_codigo": "ANI-0009", "animal": "Simba", "especie": "León",
  "insumo_clinico_id": 4, "insumo": "Metronidazol", "tipo_insumo": "medicamento", "unidad_medida": "tableta",
  "veterinario_id": 3, "veterinario": "Patricia Ortiz Ramírez", "consulta_id": 1,
  "dosis": 7.0, "via": "oral", "fecha_aplicacion": "2026-09-24 10:00:00",
  "proxima_dosis": "2026-10-04", "observaciones": "Mezclado con la carne" }
```

---

## Expedientes

### `GET /expedientes`
Filtros: `buscar` (nombre o código), `especie_id`, `estado_salud`. Solo animales con `estado = 'activo'`, ordenados por nombre.
Usa `SELECT_EXPEDIENTE` y agrega dos conteos con `CONDICION_DOSIS_PENDIENTE`:
```json
[ { "id": 9, "codigo": "ANI-0009", "nombre": "Simba", "especie_id": 6, "especie": "León", "area_id": 5,
    "area": "Recinto de leones", "sexo": "macho", "fecha_nacimiento": "2015-09-30", "peso_kg": 190,
    "estado_salud": "en_tratamiento", "ultima_consulta": "2026-09-24 09:30:00", "proxima_revision": "2026-10-04",
    "dosis_pendientes": 1, "dosis_vencidas": 0 } ]
```
- `dosis_pendientes`: dosis con `proxima_dosis <= hoy + 15 días`.
- `dosis_vencidas`: de esas, las que tienen `proxima_dosis < hoy`.

### `GET /expedientes/:animal_id`
404 si el animal no existe.
```json
{ "animal": { "id": 9, "codigo": "ANI-0009", "nombre": "Simba", "especie": "León",
              "nombre_cientifico": "Panthera leo", "area": "Recinto de leones", "sexo": "macho",
              "fecha_nacimiento": "2015-09-30", "edad_anios": 11, "peso_kg": 190, "estado_salud": "en_tratamiento" },
  "consultas": [ "objetos consulta, de la más reciente a la más antigua" ],
  "aplicaciones": [ "objetos aplicación, de la más reciente a la más antigua" ] }
```
`edad_anios` = `TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE())` (null si no hay fecha de nacimiento).

---

## Consultas

### `GET /consultas`
Filtros: `desde`, `hasta` (sobre la fecha de la consulta), `animal_id`, `veterinario_id`, `tipo`. Orden: fecha descendente. Devuelve **objetos consulta**.

### `GET /consultas/:id`
**Objeto consulta** más `"aplicaciones": [objetos aplicación de esa consulta]`. 404 si no existe.

### `POST /consultas`
Permiso `clinico.registrar`.
```json
{ "animal_id": 9, "fecha": "2026-10-01 09:00:00", "tipo": "seguimiento", "motivo": "Revisión del tratamiento",
  "sintomas": null, "diagnostico": "Mejoría", "tratamiento": "Continuar metronidazol",
  "peso_kg": 191.5, "temperatura_c": 38.6, "estado_salud_resultante": "en_observacion",
  "proxima_revision": "2026-10-08", "observaciones": null,
  "aplicaciones": [ { "insumo_clinico_id": 4, "dosis": 7, "via": "oral", "proxima_dosis": null, "observaciones": null } ] }
```
En **una transacción**:
1. El animal existe y está activo (si no, 422 en `animal_id`). La fecha no puede ser futura.
2. Insertar la consulta con `veterinario_id` = usuario en sesión.
3. Actualizar `animal.estado_salud` con `estado_salud_resultante`, y `animal.peso_kg` si vino peso.
4. Cada aplicación se registra igual que en `POST /aplicaciones`, con `consulta_id`.
5. Bitácora.

Si una aplicación falla por existencia, se revierte todo y se responde 409 indicando el producto.
Respuesta 201: `{ "id": 5 }`.

---

## Aplicaciones

### `GET /aplicaciones`
Filtros: `desde`, `hasta` (sobre `fecha_aplicacion`), `animal_id`, `tipo_insumo`. Orden: fecha descendente. Devuelve **objetos aplicación**.

### `GET /aplicaciones/pendientes?dias=15`
Dosis cuya `proxima_dosis <= hoy + dias` y que **no** tienen una aplicación posterior del mismo producto al mismo animal (`CONDICION_DOSIS_PENDIENTE`). Solo animales activos. Orden: `proxima_dosis`.
```json
[ { "aplicacion_id": 4, "animal_id": 1, "animal": "Balam", "animal_codigo": "ANI-0001", "especie": "Jaguar",
    "insumo_clinico_id": 6, "insumo": "Vacuna triple felina", "tipo_insumo": "vacuna", "unidad_medida": "dosis",
    "ultima_aplicacion": "2025-09-28 09:00:00", "ultima_dosis": 1.0, "via": "subcutanea",
    "proxima_dosis": "2026-09-28", "dias": -3, "estado": "vencida" } ]
```
`dias` = días desde hoy hasta `proxima_dosis` (negativo si ya pasó). `estado` = `vencida` si `dias < 0`, si no `proxima`.

### `POST /aplicaciones`
Permiso `clinico.registrar`. Aplicación sin consulta (por ejemplo, vacunación de rutina).
```json
{ "animal_id": 1, "fecha_aplicacion": "2026-10-01 10:15:00", "insumo_clinico_id": 6, "dosis": 1,
  "via": "subcutanea", "proxima_dosis": "2027-10-01", "observaciones": "Refuerzo anual" }
```
En **una transacción**:
1. Animal activo; producto activo con `stock_actual >= dosis` (si no, 409 "No hay suficiente *producto* (hay X)").
2. Si el producto es vacuna y no vino `proxima_dosis`, calcularla con `intervalo_refuerzo_dias`.
3. Insertar la aplicación (`veterinario_id` = usuario en sesión).
4. Insertar movimiento `salida` con `aplicacion_id` y restar `stock_actual`.
5. Bitácora.

Respuesta 201: `{ "id": 8 }`.

---

## Inventario

### `GET /inventario` ✅
Filtros: `buscar`, `tipo`, `activo`, `bajo_minimo=1`. Incluye `bajo_minimo` (0/1).

### `POST /inventario` ✅ · `PUT /inventario/:id` ✅ · `PATCH /inventario/:id/estado` ✅
Permiso `clinico.inventario.gestionar`. La existencia inicial solo se recibe al crear. Los campos de vacuna se guardan solo si `tipo = 'vacuna'`.

### `GET /inventario/:id/movimientos` ⏳
Del más reciente al más antiguo:
```json
[ { "id": 3, "tipo": "salida", "cantidad": 7.0, "aplicacion_id": 1, "animal": "Simba",
    "numero_lote": null, "fecha_vencimiento": null, "motivo": null,
    "usuario": "Patricia Ortiz Ramírez", "fecha": "2026-09-24 10:00:00" } ]
```
`animal` = animal de la aplicación (solo en salidas).

### `POST /inventario/:id/movimientos` ⏳
Permiso `clinico.inventario.gestionar`.
`{ "tipo": "entrada" | "merma", "cantidad": 50, "numero_lote": "AMX-3001", "fecha_vencimiento": "2027-06-30", "motivo": "Factura 889" }`
En una transacción: inserta el movimiento y suma o resta `stock_actual`. Merma que deja existencia negativa: 409.

---

## Reportes

Permiso `clinico.reportes.ver`. Todos reciben `?desde=&hasta=`.

### `GET /reportes/atenciones`
Una fila por veterinario con consultas o aplicaciones en el periodo:
```json
[ { "veterinario_id": 3, "veterinario": "Patricia Ortiz Ramírez", "rutina": 4, "emergencia": 1,
    "seguimiento": 2, "ingreso": 0, "total": 7, "aplicaciones": 9 } ]
```

### `GET /reportes/consumo`
Una fila por producto activo: entradas, salidas (aplicaciones) y mermas del periodo, más existencia actual.
```json
[ { "insumo_clinico_id": 4, "nombre": "Metronidazol", "tipo": "medicamento", "unidad_medida": "tableta",
    "entradas": 50, "salidas": 7, "mermas": 0, "stock_actual": 40, "stock_minimo": 20 } ]
```

### `GET /reportes/vacunacion`
Aplicaciones de productos tipo vacuna en el periodo, por fecha:
```json
[ { "fecha_aplicacion": "2026-09-20 09:00:00", "animal": "Ixchel", "animal_codigo": "ANI-0002",
    "especie": "Jaguar", "vacuna": "Vacuna triple felina", "enfermedad_previene": "Panleucopenia...",
    "veterinario": "Patricia Ortiz Ramírez", "proxima_dosis": "2027-09-20" } ]
```

---

## Tarjetas del inicio (`resumenDashboard` en `index.js`)

| Tarjeta sugerida | Color | url |
|---|---|---|
| "Dosis vencidas" | `peligro` | `/app/clinico/aplicaciones.html` |
| "Dosis en los próximos 7 días" | `alerta` | `/app/clinico/aplicaciones.html` |
| "Productos clínicos bajo el mínimo" | `peligro` si hay alguno | `/app/clinico/inventario.html?bajo_minimo=1` |

El conteo de animales en tratamiento ya lo muestra el núcleo.
