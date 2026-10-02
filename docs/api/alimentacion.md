# API del módulo de Alimentación

Responsable: **Mijeli**. A diferencia de los otros módulos, este se programa completo (interfaz y backend) y sirve como referencia.

- Base: `/api/alimentacion`. El núcleo ya exige sesión y el permiso `alimentacion.ver`.
- Respuestas con el formato estándar: `{ ok: true, datos, mensaje? }` o `{ ok: false, mensaje, errores? }`.
- Cada cambio se registra en la bitácora (`modulo: 'alimentacion'`).
- Cantidades con hasta 3 decimales en la unidad del alimento (`kg`, `g`, `l` o `unidad`). Montos en quetzales.

## Estado

| Parte | Funcionalidad | Estado |
|---|---|---|
| 4A | Alimentos, existencia y alertas | ✅ |
| 4A | Entradas por compra (lotes), corrección de datos, mermas e historial | ✅ |
| 4A | Proveedores y sus entregas | ✅ |
| 4A | Tarjetas del inicio (alertas de inventario) | ✅ |
| 4B | Dietas por especie o por animal, qué come cada animal | ✅ |
| 4B | Horarios por jaula y resumen de cobertura | ✅ |
| 4C | Raciones del día con descuento FEFO y deshacer | ✅ |
| 4C | Reportes (consumo, especies, cumplimiento, compras, vencimientos) | ✅ |

## Permisos

| Permiso | Roles |
|---|---|
| `alimentacion.ver` | Administrador, director, veterinario, cuidador, encargado de bodega |
| `alimentacion.inventario.ver` | Administrador, director, veterinario, encargado de bodega |
| `alimentacion.inventario.gestionar` | Administrador, encargado de bodega |
| `alimentacion.dietas.ver` | Administrador, director, veterinario, cuidador |
| `alimentacion.dietas.gestionar` | Veterinario (el que esté en sesión queda como responsable) |
| `alimentacion.horarios.ver` | Administrador, director, veterinario, cuidador |
| `alimentacion.horarios.gestionar` | Administrador, veterinario |
| `alimentacion.raciones.ver` | Administrador, director, veterinario, cuidador |
| `alimentacion.raciones.registrar` | Cuidador |
| `alimentacion.reportes.ver` | Administrador, director, veterinario, encargado de bodega |

El director solo consulta.

---

## Reglas del inventario

1. **La existencia no se guarda en `alimento`.** Es la suma de `cantidad_disponible` de los lotes **no vencidos** del alimento. Así nunca se desincroniza.
2. Lo que queda en lotes vencidos se informa aparte (`existencia_vencida`) y se saca con una **merma** ("Dar de baja").
3. **Bajo el mínimo:** `existencia <= stock_minimo`.
4. **Por vencer:** lote con existencia cuyo vencimiento cae entre hoy y `hoy + dias_aviso_vencimiento` del alimento.
5. Cada entrada crea un lote y un movimiento `entrada`. Cada merma resta del lote y crea un movimiento `merma` con motivo obligatorio. Los consumos (4C) salen del lote que vence primero (FEFO).
6. Un lote nunca queda en negativo: la merma bloquea la fila (`SELECT … FOR UPDATE`) dentro de la transacción y valida contra lo disponible.
7. No se puede cambiar la unidad de un alimento que ya tiene lotes, ni desactivar un alimento que está en dietas activas.

---

## Alimentos

### `GET /alimentos` (`inventario.ver`)
Filtros: `buscar`, `categoria`, `alerta` (`bajo_minimo` | `por_vencer` | `vencido`), `activo` (`1` | `0` | vacío = todos).
```json
[ { "id": 1, "nombre": "Carne de res", "categoria": "carne", "unidad_medida": "kg", "stock_minimo": 40,
    "dias_aviso_vencimiento": 3, "descripcion": "Cortes sin hueso", "activo": 1,
    "existencia": 35, "existencia_vencida": 0, "proximo_vencimiento": "2026-10-05", "dias_para_vencer": 4,
    "lotes_con_existencia": 1, "consumo_diario": 5.286, "bajo_minimo": 1, "por_vencer": 0, "dietas_activas": 3 } ]
```
`consumo_diario` = consumo de los últimos 7 días ÷ 7 (la pantalla calcula cuántos días alcanza la existencia).

### `GET /alimentos/alertas` (`inventario.ver`)
```json
{ "bajo_minimo": [ "objetos alimento" ],
  "por_vencer": [ { "id": 13, "numero_lote": "RM-001", "alimento_id": 11, "alimento": "Ramas y follaje de ramoneo",
                    "unidad_medida": "kg", "cantidad_disponible": 80, "fecha_vencimiento": "2026-10-02",
                    "dias_para_vencer": 1, "estado": "por_vencer" } ],
  "vencidos": [ "mismos campos, estado 'vencido'" ] }
```

### `GET /alimentos/:id`, `POST /alimentos`, `PUT /alimentos/:id`, `PATCH /alimentos/:id/estado`
Escritura con `inventario.gestionar`.
```json
{ "nombre": "Grillos vivos", "categoria": "insecto", "unidad_medida": "unidad",
  "stock_minimo": 200, "dias_aviso_vencimiento": 5, "descripcion": null }
```
- 422 si el nombre ya existe o si se cambia la unidad de un alimento con lotes.
- 409 al desactivar un alimento con dietas activas.

### `GET /alimentos/:id/movimientos?desde=&hasta=`
Últimos 300 movimientos de todos sus lotes:
```json
[ { "id": 21, "tipo": "consumo", "cantidad": 4.5, "motivo": null, "fecha": "2026-09-30 16:33:00",
    "lote_id": 1, "numero_lote": "CR-001", "alimento_id": 1, "alimento": "Carne de res", "unidad_medida": "kg",
    "registro_id": 11, "animal": "Simba", "animal_codigo": "ANI-0009", "usuario": "Andrea Pineda Morales" } ]
```

---

## Lotes (entradas por compra)

### `GET /lotes` (`inventario.ver`)
Filtros: `alimento_id`, `proveedor_id`, `estado` (`disponible` | `por_vencer` | `vencido` | `agotado` | `con_existencia`), `desde` y `hasta` (fecha de ingreso), `buscar` (lote, factura o alimento). Orden: vencidos, por vencer, disponibles y agotados; dentro de cada grupo, el que vence primero.
```json
[ { "id": 1, "alimento_id": 1, "proveedor_id": 1, "numero_lote": "CR-001", "numero_factura": "F-1021",
    "fecha_ingreso": "2026-09-28", "fecha_vencimiento": "2026-10-05", "cantidad_inicial": 72, "cantidad_disponible": 35,
    "costo_unitario": 38.5, "usuario_id": 5, "observaciones": null, "creado_en": "…",
    "alimento": "Carne de res", "categoria": "carne", "unidad_medida": "kg", "dias_aviso_vencimiento": 3,
    "proveedor": "Carnicería La Ganadera", "registrado_por": "María José Ruiz Aguilar",
    "cantidad_usada": 37, "costo_total": 2772, "dias_para_vencer": 4, "estado": "disponible" } ]
```

### `POST /lotes` (`inventario.gestionar`) — entrada por compra
```json
{ "alimento_id": 12, "cantidad": 500, "proveedor_id": 5, "numero_lote": "GR-001", "numero_factura": "EP-1001",
  "fecha_ingreso": "2026-10-01", "fecha_vencimiento": "2026-10-21", "costo_unitario": 0.35, "observaciones": null }
```
- 422 si: el alimento o el proveedor están inactivos, el número de lote ya existe para ese alimento, el ingreso es futuro, el vencimiento es anterior al ingreso o el producto ya está vencido.
- En una transacción: crea el lote (`cantidad_disponible = cantidad`), el movimiento `entrada` y la bitácora. Responde **201** `{ id }`.

### `PUT /lotes/:id` (`inventario.gestionar`) — corregir datos del documento
Mismos campos **sin** `alimento_id` ni `cantidad` (no se pueden cambiar; para sacar producto se usa una merma).

### `POST /lotes/:id/mermas` (`inventario.gestionar`)
```json
{ "cantidad": 3, "motivo": "Lote vencido el 30/09/2026" }
```
422 si la cantidad supera lo disponible. Responde **201** `{ id, disponible }`.

### `GET /lotes/:id/movimientos`
Mismo formato que el historial de un alimento.

---

## Proveedores

### `GET /proveedores` (`inventario.ver`)
Filtros: `buscar` (nombre, NIT o contacto), `activo`.
```json
[ { "id": 1, "nombre": "Carnicería La Ganadera", "nit": "4521873-1", "contacto": "Marco Tulio Ávila",
    "telefono": "7844-1020", "correo": "ventas@laganadera.gt", "direccion": "Barrio El Centro, Jutiapa", "activo": 1,
    "compras": 2, "ultima_compra": "2026-09-29", "total_comprado": 4092 } ]
```
Las entregas de un proveedor se consultan con `GET /lotes?proveedor_id=1`.

### `GET /proveedores/:id`, `POST /proveedores`, `PUT /proveedores/:id`, `PATCH /proveedores/:id/estado`
```json
{ "nombre": "Insectario Jutiapa", "nit": "1234567-8", "contacto": "Pedro López", "telefono": "5555-0000",
  "correo": "insectos@mail.gt", "direccion": null }
```
422 si el nombre o el NIT ya existen. Un proveedor inactivo no se puede elegir en entradas nuevas.

---


---

## Dietas

### Reglas
1. Una dieta es para **una especie** o para **un animal**, nunca para ambos (`destino`).
2. **Vigente en una fecha F:** `activa = 1`, `fecha_inicio <= F` y `fecha_fin` vacía o `>= F`.
3. **Las dietas propias reemplazan a las de la especie:** si un animal tiene al menos una dieta propia vigente, no se le aplica ninguna de su especie.
4. Una dieta propia exige `motivo` (por qué el animal necesita algo distinto).
5. No puede haber dos dietas activas del mismo destino y alimento con fechas que se crucen.
6. **Cambiar una dieta conserva el historial:** si todavía no tiene raciones registradas, se corrige directamente. Si ya tiene, se finaliza hoy y se crea una dieta nueva desde hoy con los cambios.
7. Finalizar una dieta la deja de aplicar desde hoy (`activa = 0`, `fecha_fin = hoy`).
8. Solo un usuario que esté en la tabla `veterinario` puede registrar o cambiar dietas (403 si no).

### `GET /dietas` (`dietas.ver`)
Filtros: `buscar` (especie, animal o alimento), `destino` (`especie` | `animal`), `especie_id` (incluye las dietas propias de animales de esa especie), `animal_id`, `alimento_id`, `estado` (`vigente` | `programada` | `finalizada` | `actual` = vigentes y programadas).
```json
[ { "id": 1, "especie_id": 1, "animal_id": null, "alimento_id": 1, "cantidad_racion": 4, "frecuencia_diaria": 1,
    "indicaciones": "En trozos grandes", "motivo": null, "veterinario_id": 3, "fecha_inicio": "2026-08-02", "fecha_fin": null, "activa": 1,
    "destino": "especie", "especie": "Jaguar", "especie_ref_id": 1, "animal": null, "animal_codigo": null, "area": null,
    "alimento": "Carne de res", "categoria_alimento": "carne", "unidad_medida": "kg", "veterinario": "Patricia Ortiz Ramírez",
    "racion_diaria": 4, "estado": "vigente", "raciones_registradas": 4, "animales_aplica": 2 } ]
```
`animales_aplica`: en dietas de especie, cuántos animales activos de la especie la usan hoy (los que no tienen dieta propia).

### `GET /dietas/por-animal?fecha=&area_id=&especie_id=&animal_id=&buscar=` (`dietas.ver`)
Qué come cada animal activo en la fecha (hoy por defecto), ordenado por jaula:
```json
[ { "id": 9, "codigo": "ANI-0009", "nombre": "Simba", "especie_id": 6, "especie": "León", "area_id": 5, "area": "Recinto de leones",
    "estado_salud": "en_tratamiento", "peso_kg": 190, "origen": "animal",
    "dietas": [ { "animal_id": 9, "dieta_id": 11, "alimento_id": 1, "alimento": "Carne de res", "unidad_medida": "kg",
                  "cantidad_racion": 4.5, "frecuencia_diaria": 1, "racion_diaria": 4.5, "indicaciones": "Ración reducida, sin hueso",
                  "motivo": "Dieta reducida durante tratamiento digestivo", "fecha_inicio": "2026-09-24", "fecha_fin": null,
                  "origen": "animal", "veterinario": "Patricia Ortiz Ramírez" } ] } ]
```
`origen` es `animal`, `especie` o `null` (sin dieta vigente).

### `POST /dietas` y `PUT /dietas/:id` (`dietas.gestionar`)
```json
{ "destino": "animal", "animal_id": 4, "alimento_id": 4, "cantidad_racion": 0.8, "frecuencia_diaria": 3,
  "indicaciones": null, "motivo": "En observación: raciones pequeñas y frecuentes", "fecha_inicio": "2026-10-01", "fecha_fin": null }
```
Con `destino: "especie"` se envía `especie_id` en lugar de `animal_id`.
- 422 si: la especie o el animal no están activos, el alimento está inactivo, falta el motivo de una dieta propia, la fecha final es anterior al inicio o ya pasó, o se cruza con otra dieta del mismo destino y alimento.
- `PUT` responde `{ id, reemplazada }`. Si `reemplazada` es `true`, `id` es la dieta nueva. 409 si la dieta ya estaba finalizada.

### `PATCH /dietas/:id/finalizar` (`dietas.gestionar`)
`{ "motivo": "Ya se recuperó" }` (opcional, queda en la bitácora). 409 si ya estaba finalizada.

---

## Horarios de alimentación

### Reglas
1. Cada horario es de una jaula activa (`area.tipo = 'jaula'`), a una hora, ciertos días (`dias`, al menos uno) y con un cuidador activo responsable.
2. Una jaula no puede tener dos horarios a la misma hora.
3. **Una dieta con `frecuencia_diaria = N` se sirve en los primeros N horarios del día** de la jaula del animal. Por eso cada jaula necesita, los días que se alimenta, al menos tantos horarios como la mayor frecuencia de sus dietas.
4. No se puede activar un horario cuyo cuidador está inactivo (409); primero se cambia el cuidador.
5. Un horario solo programa raciones desde el día en que se creó (`creado_en`).

### `GET /horarios` (`horarios.ver`)
Filtros: `area_id`, `cuidador_id`, `dia` (`lun` … `dom`), `activo`.
```json
[ { "id": 4, "area_id": 3, "area": "Pantano de cocodrilos", "habitat": "Herpetario", "hora": "11:00", "dias": ["mar", "vie"],
    "cuidador_id": 10, "cuidador": "Andrea Pineda Morales", "cuidador_activo": 1,
    "observaciones": "Alimentar desde la plataforma de seguridad", "activo": 1, "animales": 1 } ]
```

### `POST /horarios`, `PUT /horarios/:id`, `PATCH /horarios/:id/estado` (`horarios.gestionar`)
```json
{ "area_id": 2, "hora": "17:30", "dias": ["sab", "dom"], "cuidador_id": 4, "observaciones": null }
```
Los días se guardan ordenados y sin repetir.

### `GET /horarios/cobertura` (`horarios.ver`)
Una fila por jaula activa con las dietas vigentes de hoy:
```json
[ { "area_id": 2, "area": "Isla de monos araña", "habitat": "Selva Tropical", "animales": 2, "animales_con_dieta": 2,
    "raciones_por_dia": 3, "horarios_por_dia": { "lun": 2, "mar": 2, "mie": 2, "jue": 2, "vie": 2, "sab": 2, "dom": 2 },
    "avisos": [ "Las dietas piden 3 raciones al día, pero todos los días solo hay 2 horarios." ] } ]
```
Avisos posibles: animales sin dieta vigente, animales con dieta pero ningún horario, y días con menos horarios que raciones. Los días sin ningún horario se consideran ayuno programado (por ejemplo, los cocodrilos comen martes y viernes).


---

## Raciones del día

### Cómo se arma un día
1. Horarios activos de cada jaula que tocan ese día de la semana y ya existían ese día, numerados por hora: 1.ª, 2.ª, 3.ª comida del día.
2. Dietas vigentes de cada animal activo de la jaula en esa fecha (las propias reemplazan a las de la especie).
3. Una dieta con `frecuencia_diaria = N` aparece en las comidas 1 a N.
4. Estado del turno: `completo`, `parcial` (algunas registradas), `pendiente`, `atrasado` (hoy, una hora después de su hora y sin completar) o `no_registrado` (días anteriores).

### `GET /raciones?fecha=&area_id=&cuidador_id=` (`raciones.ver`)
Fecha por defecto hoy; no acepta fechas futuras. La pantalla del cuidador envía su propio `cuidador_id`.
```json
{ "fecha": "2026-10-01", "es_hoy": true,
  "resumen": { "turnos": 7, "programadas": 23, "registradas": 5, "pendientes": 18, "turnos_atrasados": 0 },
  "turnos": [ { "horario_id": 8, "area_id": 6, "area": "Gran aviario", "habitat": "Aviario Quetzal", "hora": "07:00",
                "cuidador_id": 4, "cuidador": "Carlos Hernández López", "observaciones": null, "numero": 1,
                "total": 5, "registradas": 5, "estado": "completo",
                "animales": [ { "animal_id": 13, "nombre": "Arcoíris", "codigo": "ANI-0013", "especie": "Tucán pico iris", "estado_salud": "sano",
                                "raciones": [ { "dieta_id": 14, "alimento_id": 4, "alimento": "Frutas mixtas", "unidad_medida": "kg",
                                                "cantidad_racion": 0.12, "frecuencia_diaria": 2, "indicaciones": "Trozos pequeños", "origen": "especie",
                                                "existencia": 61.45,
                                                "registro": { "id": 59, "usuario_id": 4, "usuario": "Carlos Hernández López", "hora": "08:54",
                                                              "cantidad_suministrada": 0.12, "consumo": "parcial", "observaciones": "Dejó la papaya" } } ] } ] } ] }
```
`registro` es `null` mientras la ración no se registra. `existencia` es lo que hay del alimento en lotes sin vencer.

### `POST /raciones` (`raciones.registrar`)
Una o varias raciones de **un turno de hoy**, todo o nada:
```json
{ "horario_id": 8,
  "items": [ { "animal_id": 13, "dieta_id": 14, "cantidad_suministrada": 0.12, "consumo": "parcial", "observaciones": "Dejó la papaya" },
             { "animal_id": 12, "dieta_id": 12, "cantidad_suministrada": 0.15, "consumo": "completo" } ] }
```
`consumo`: `completo` | `parcial` | `nulo`. La fecha y la hora las pone el servidor; el usuario es el de la sesión (cualquier cuidador puede cubrir el turno de un compañero).
1. 422 si el turno no toca hoy o la ración no está programada en ese turno; 409 si ya estaba registrada.
2. En una transacción se bloquean (`FOR UPDATE`) los lotes sin vencer del alimento en orden FEFO (vence primero, los que no vencen al final). Si la suma no alcanza responde **409** con lo que hay en bodega.
3. Por cada ración: inserta `registro_alimentacion`, descuenta de uno o varios lotes y crea un movimiento `consumo` por lote usado.
Responde **201**:
```json
[ { "id": 24, "animal_id": 2, "dieta_id": 1, "lotes": [ { "lote_id": 1, "numero_lote": "CR-001", "cantidad": 15 },
                                                        { "lote_id": 14, "numero_lote": "CR-777", "cantidad": 5 } ] } ]
```

### `DELETE /raciones/:id` (`raciones.registrar`)
Solo quien la registró y el mismo día. Devuelve a cada lote lo que se le descontó y borra la ración y sus movimientos (queda en la bitácora).

---

## Reportes (`reportes.ver`)
Reciben `desde` y `hasta`; la pantalla usa la última semana por defecto.

| Ruta | Una fila por | Campos |
|---|---|---|
| `GET /reportes/consumo-alimentos` | alimento con movimientos | `alimento`, `categoria`, `unidad_medida`, `raciones`, `entradas`, `consumido`, `merma`, `costo_consumo`, `costo_merma` (costo según el lote) |
| `GET /reportes/consumo-especies` | especie y alimento | `especie`, `alimento`, `unidad_medida`, `animales`, `raciones`, `cantidad`, `parciales`, `rechazadas` |
| `GET /reportes/cumplimiento` | jaula | `area`, `cuidadores`, `turnos`, `programadas`, `registradas`, `pendientes`, `parciales`, `rechazadas`, `cumplimiento` (%). Máximo 62 días; de hoy solo cuentan los turnos cuya hora ya pasó |
| `GET /reportes/compras` | proveedor | `proveedor`, `nit`, `entregas`, `alimentos`, `detalle`, `ultima_entrega`, `total` (por fecha de ingreso del lote) |
| `GET /reportes/vencimientos?dias=30` | lote con existencia | `numero_lote`, `alimento`, `proveedor`, `fecha_vencimiento`, `dias_para_vencer`, `cantidad_disponible`, `valor`, `estado` (`vencido` o `por_vencer`). No usa el rango |

---

## Tarjetas del inicio
- Cuidador: sus raciones pendientes de hoy y sus turnos atrasados.
- Administrador, director y veterinario: raciones pendientes y turnos atrasados de todo el zoológico.
- Con `alimentacion.inventario.ver`: alimentos bajo el mínimo, lotes por vencer y lotes vencidos con existencia.
- Con `alimentacion.horarios.gestionar`: jaulas con avisos de alimentación.

## Datos de prueba
`database/20_alimentacion.sql` genera las raciones de los dos días anteriores con estas mismas reglas (con algunos turnos sin registrar y algunas raciones comidas en parte) y al final recalcula la existencia de cada lote a partir de sus movimientos.
