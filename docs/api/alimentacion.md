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
| 4B | Dietas y horarios | ⏳ |
| 4C | Raciones del día, reportes | ⏳ |

## Permisos

| Permiso | Roles |
|---|---|
| `alimentacion.ver` | Administrador, director, veterinario, cuidador, encargado de bodega |
| `alimentacion.inventario.ver` | Administrador, director, veterinario, encargado de bodega |
| `alimentacion.inventario.gestionar` | Administrador, encargado de bodega |

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

## Tarjetas del inicio
Para quien tiene `alimentacion.inventario.ver`: alimentos bajo el mínimo, lotes por vencer y lotes vencidos con existencia, cada una con enlace a la pantalla filtrada.
