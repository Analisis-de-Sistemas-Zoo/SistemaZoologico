# API del módulo de Entradas y Promociones

Responsable del backend: **Mario**. La interfaz ya está construida (portal de compra, taquilla, validación, ventas y reportes) y llama exactamente a estas rutas.

- Dos bases:
  - `/api/publico/entradas`: portal de visitantes, **sin sesión**. Lo usan `public/entradas/comprar.html` y `mis-entradas.html`.
  - `/api/entradas`: personal del zoológico. El núcleo ya exige sesión y el permiso `entradas.ver`.
- Las reglas de validación ya están en `server/modulos/entradas/entradas.routes.js`. Al controlador solo llegan datos válidos (`datosValidos(req)`).
- Las consultas base (`SELECT_VENTA`, `SELECT_DETALLE`, `SELECT_ENTRADAS`) ya están en `ventas.model.js`.
- Respuestas con el formato estándar: `{ ok: true, datos, mensaje? }` o `{ ok: false, mensaje, errores? }`.
- Cada venta, anulación y validación se registra en la bitácora (`modulo: 'entradas'`). En compras web no hay usuario en sesión: `bitacora.registrar` acepta `req` igual, el usuario queda en `NULL`.
- Fechas `AAAA-MM-DD`; fecha y hora `AAAA-MM-DD HH:MM:SS`. Montos en quetzales con 2 decimales.

## Estado

| Funcionalidad | Estado |
|---|---|
| Tipos de entrada: listar, crear, editar, activar/desactivar | ✅ Implementada (ejemplo) |
| Promociones: listar, crear, editar, activar/desactivar | ✅ Implementada (ejemplo) |
| Portal: tipos y promociones públicas | ✅ Implementada |
| Cotización (portal y taquilla) | ✅ Implementada |
| Compra web y consulta de "Mis entradas" | ✅ Implementada |
| Venta en taquilla | ✅ Implementada |
| Lista y detalle de ventas, anulación | ✅ Implementada |
| Validación de ingreso y resumen del día | ✅ Implementada |
| Reportes | ✅ Implementada |
| Tarjetas del inicio (`index.js → resumenDashboard`) | ✅ Implementada |

## Permisos

| Permiso | Roles |
|---|---|
| `entradas.ver` | Administrador, director, taquillero |
| `entradas.vender` | Administrador, taquillero |
| `entradas.validar` | Administrador, taquillero |
| `entradas.ventas.ver` | Administrador, director, taquillero |
| `entradas.ventas.anular` | Administrador |
| `entradas.configurar` | Administrador (tipos y promociones) |
| `entradas.reportes.ver` | Administrador, director |

---

## Reglas del negocio

### Fecha de visita
- No puede ser anterior a hoy ni mayor a hoy + 60 días.
- **Los lunes el zoológico está cerrado**: responde 422 con `errores: [{ campo: 'fecha_visita', mensaje: 'Los lunes el zoológico está cerrado.' }]`.
- Todos los tipos de entrada pedidos deben existir y estar activos (422 si no).

### Promociones (cómo se calcula el descuento)
Programa **una sola función interna** `calcularCotizacion(fecha_visita, items, codigo, conn?)` y úsala en las tres rutas que cobran (cotizar, compra web y venta en taquilla). Así el total siempre se calcula igual. Como una compra se guarda, recibe `conn` para que la lectura de precios y promociones ocurra dentro de la misma transacción.

1. Una promoción **aplica** si `activa = 1` y `fecha_visita` está entre `fecha_inicio` y `fecha_fin` (ambas incluidas). Se compara con la fecha de **visita**, no con la de compra.
2. Si la promoción tiene `codigo` (cupón), solo aplica cuando el cliente envía ese mismo código en `codigo_promocion`.
3. `tipo_entrada_id = NULL` aplica a todas las líneas; si tiene valor, solo a las líneas de ese tipo.
4. `cantidad_minima`:
   - Promoción para todos los tipos: se compara con el **total de entradas** de la compra.
   - Promoción de un tipo: se compara con la **cantidad de ese tipo**.
5. Si varias promociones aplican a una línea, se usa **la de mayor porcentaje** (solo una por línea, no se acumulan).
6. Por línea: `descuento = round(cantidad × precio × porcentaje / 100, 2)` y `subtotal = cantidad × precio − descuento`.
7. Totales: `subtotal` = suma de `cantidad × precio`, `descuento` = suma de descuentos, `total` = subtotal − descuento.
8. El precio se toma de `tipo_entrada.precio` en ese momento y se guarda en `detalle_compra.precio_unitario` (cambiar el precio después no afecta ventas hechas).

Ejemplo con los datos de prueba: 2 Adulto (Q40) + 2 Niño (Q20) con el "Paquete familiar" (15 %, desde 4 entradas):
`Adulto 2 × 40 = 80 − 12 = 68`, `Niño 2 × 20 = 40 − 6 = 34`, total **Q102.00**.

### Cupón
Cuando llega `codigo_promocion` la respuesta trae `cupon`:
- `{ "codigo": "FERIA2026", "valido": true, "mensaje": "Cupón aplicado: Feria de Jutiapa (10 %)." }`
- `{ "codigo": "XYZ", "valido": false, "mensaje": "El cupón no existe o no está vigente para la fecha de visita." }`
- Si el cupón existe pero otra promoción da más descuento: `valido: true`, mensaje `"Ya tienes un descuento mayor; el cupón no se acumula."`

Un cupón inválido **no** es error: la cotización responde 200 con `valido: false`. Sin `codigo_promocion`, `cupon` es `null`.

### Entradas y códigos
- Por cada unidad vendida se crea una fila en `entrada` con `codigo_qr = crypto.randomBytes(16).toString('hex')` (32 caracteres hex) y `estado = 'vigente'`.
- Código de compra: `'MS-' + String(id).padStart(6, '0')`. Inserta la compra con un código temporal, toma el `insertId` y actualiza el código, todo dentro de `db.transaccion`.
- Estado que se **muestra** de una entrada: si está `vigente` y su `fecha_visita` ya pasó, se responde `"vencida"` (no se guarda; se calcula en la consulta).

---

## Objetos

### Objeto cotización
```json
{ "fecha_visita": "2026-10-10",
  "lineas": [
    { "tipo_entrada_id": 1, "tipo_entrada": "Adulto", "cantidad": 2, "precio_unitario": 40.00,
      "promocion_id": 1, "promocion": "Paquete familiar", "descuento": 12.00, "subtotal": 68.00 },
    { "tipo_entrada_id": 2, "tipo_entrada": "Niño", "cantidad": 2, "precio_unitario": 20.00,
      "promocion_id": 1, "promocion": "Paquete familiar", "descuento": 6.00, "subtotal": 34.00 } ],
  "subtotal": 120.00, "descuento": 18.00, "total": 102.00,
  "cupon": null }
```

### Objeto venta (`SELECT_VENTA` + `detalle` + `entradas`)
```json
{ "id": 1, "codigo": "MS-000001", "canal": "web", "fecha": "2026-09-28 20:15:00", "fecha_visita": "2026-09-30",
  "subtotal": 120.00, "descuento": 18.00, "total": 102.00, "metodo_pago": "tarjeta", "referencia_pago": "AUT-558120",
  "estado": "pagada", "motivo_anulacion": null, "fecha_anulacion": null,
  "cliente_id": 1, "cliente": "Familia Orellana", "cliente_correo": "gorellana@correo.gt", "cliente_nit": "CF",
  "vendedor_id": null, "vendedor": null, "anulado_por": null, "cantidad_entradas": 4,
  "detalle": [ "filas de SELECT_DETALLE (mismos campos que las líneas de la cotización)" ],
  "entradas": [
    { "id": 1, "codigo_qr": "9f2c…32 hex…", "tipo_entrada": "Adulto", "estado": "usada", "fecha_uso": "2026-09-30 10:12:00" } ] }
```
En la lista (`GET /ventas`) no hace falta `detalle` ni `entradas`.

---

## Portal público (`/api/publico/entradas`)

### `GET /tipos` ✅ y `GET /promociones` ✅
Ya implementadas en `catalogo.controller.js`. Las promociones públicas nunca muestran el código del cupón (solo `requiere_cupon`).

### `POST /cotizar`
```json
{ "fecha_visita": "2026-10-10",
  "items": [ { "tipo_entrada_id": 1, "cantidad": 2 }, { "tipo_entrada_id": 2, "cantidad": 2 } ],
  "codigo_promocion": "FERIA2026" }
```
Responde el **objeto cotización**. No guarda nada. La misma función atiende `POST /api/entradas/cotizar` (taquilla).

### `POST /compras`
Compra web del visitante. Tiene límite de 15 intentos cada 15 minutos por IP (ya configurado).
```json
{ "fecha_visita": "2026-10-10",
  "items": [ { "tipo_entrada_id": 1, "cantidad": 2 } ],
  "codigo_promocion": null,
  "cliente": { "nombre": "Ana López", "correo": "ana@correo.gt", "telefono": "5555-1234", "nit": "CF" },
  "pago": { "titular": "ANA LOPEZ", "numero": "4111111111111111", "vencimiento": "12/28", "cvv": "123" } }
```
1. Recalcula con `cotizar(...)` (nunca confíes en totales que mande el navegador).
2. **Pago simulado**: rechaza con 422 en `pago.vencimiento` si la tarjeta ya venció ("La tarjeta está vencida."). Si no, aprueba y genera `referencia_pago = 'AUT-' + 6 dígitos aleatorios`.
   **Nunca guardes el número completo, el vencimiento ni el CVV.** Si quieres una referencia, guarda solo los últimos 4 dígitos dentro de `referencia_pago` (ej. `AUT-558120 ****1111`).
3. En una transacción: busca el cliente por `correo` (si existe, actualiza nombre/teléfono/NIT; si no, lo crea), inserta `compra` (`canal = 'web'`, `metodo_pago = 'tarjeta'`, `vendedor_id = NULL`), el detalle y las entradas.
4. Responde **201** con el **objeto venta** completo (con `entradas`): la página muestra los QR de inmediato.

### `GET /compras/consulta?codigo=MS-000001&correo=gorellana@correo.gt`
Para "Mis entradas". Busca la compra con ese código **y** cuyo cliente tenga ese correo.
- Si no coincide responde **404** `"No encontramos una compra con esos datos."` (el mismo mensaje si no existe el código o si el correo no coincide; así no se revela qué compras existen).
- Si coincide, responde el **objeto venta** completo. También muestra compras anuladas (la página avisa que no son válidas).

---

## Taquilla (`/api/entradas`)

### `POST /cotizar` (`entradas.vender`)
Igual que la pública.

### `POST /ventas` (`entradas.vender`)
```json
{ "fecha_visita": "2026-10-01", "items": [ { "tipo_entrada_id": 1, "cantidad": 1 } ], "codigo_promocion": null,
  "metodo_pago": "efectivo", "cliente": { "nombre": "", "nit": "" } }
```
- `vendedor_id` = usuario en sesión, `canal = 'taquilla'`.
- Cliente opcional: si viene `cliente.nombre`, crea un cliente (correo `NULL`, NIT o `'CF'`). Si no, `cliente_id = NULL` (consumidor final).
- Con tarjeta genera `referencia_pago` como en la compra web; con efectivo queda `NULL`. El vuelto lo calcula la pantalla, no se guarda.
- Responde **201** con el **objeto venta** completo: la pantalla abre las entradas para imprimir.

---

## Ventas

### `GET /ventas` (`entradas.ventas.ver`)
Filtros: `desde`, `hasta` (sobre `DATE(c.fecha)`), `canal`, `estado`, `buscar` (código, nombre del cliente o NIT). Orden: más reciente primero. Lista de objetos venta sin `detalle` ni `entradas`. La pantalla calcula los totales de arriba con esta lista.

### `GET /ventas/:id` (`entradas.ventas.ver`)
Objeto venta completo. 404 si no existe.

### `PATCH /ventas/:id/anular` (`entradas.ventas.anular`)
```json
{ "motivo": "Cobro duplicado" }
```
- 404 si no existe; 409 si ya está anulada (`"La venta ya está anulada."`).
- 409 si alguna entrada ya fue usada (`"No se puede anular: 2 entradas ya ingresaron al zoológico."`).
- En una transacción: `compra.estado = 'anulada'`, `motivo_anulacion`, `anulado_por_id` (usuario en sesión), `fecha_anulacion = NOW()`, y todas sus entradas a `'anulada'`.
- Responde el objeto venta actualizado.

---

## Validación de ingreso

### `POST /validar` (`entradas.validar`)
```json
{ "codigo_qr": "9f2c0e4b7a1d4c3e8b6a5f0e1d2c3b4a" }
```
**Siempre responde 200** con el resultado (rechazar una entrada no es un error del sistema; la pantalla lo pinta en grande). Solo un código con formato inválido da 422 (ya lo hacen las reglas).

```json
{ "resultado": "valida",
  "mensaje": "Bienvenido. Entrada Adulto registrada a las 10:15.",
  "entrada": { "codigo_qr": "9f2c…", "tipo_entrada": "Adulto", "fecha_visita": "2026-10-01",
               "compra_codigo": "MS-000004", "cliente": "Karla Juárez", "estado": "usada", "fecha_uso": "2026-10-01 10:15:00" } }
```

| `resultado` | Cuándo | Mensaje sugerido |
|---|---|---|
| `valida` | Vigente, compra pagada y `fecha_visita = hoy`. Se marca `usada`, `fecha_uso = NOW()`, `validador_id` = usuario. | "Bienvenido. Entrada Adulto registrada a las 10:15." |
| `usada` | Ya tiene `estado = 'usada'` | "Esta entrada ya ingresó el 01/10/2026 a las 09:41." |
| `anulada` | Entrada o compra anulada | "Esta entrada fue anulada y no es válida." |
| `otra_fecha` | Vigente pero `fecha_visita` ≠ hoy | "Esta entrada es para el sábado 4 de octubre." (o "Venció el …") |
| `no_existe` | No hay entrada con ese código (`entrada: null`) | "El código no pertenece a ninguna entrada." |

Haz el `UPDATE … WHERE id = ? AND estado = 'vigente'` y revisa `affectedRows`: así dos lectores al mismo tiempo no dejan pasar la misma entrada dos veces.

### `GET /ingresos/hoy` (`entradas.validar`)
```json
{ "entradas_del_dia": 14, "ingresados": 9, "pendientes": 5,
  "ultimos": [ { "fecha_uso": "2026-10-01 10:15:00", "tipo_entrada": "Adulto", "compra_codigo": "MS-000004", "validador": "Luis Taquillero" } ] }
```
- `entradas_del_dia`: entradas no anuladas de compras pagadas con `fecha_visita = hoy`.
- `ingresados`: de esas, las `usada`. `pendientes` = la diferencia.
- `ultimos`: las 10 últimas validadas hoy, más reciente primero.

---

## Reportes (`entradas.reportes.ver`)

Todos reciben `desde` y `hasta` (obligatorios en la pantalla) sobre la **fecha de la compra** (`DATE(c.fecha)`) y **excluyen ventas anuladas**.

### `GET /reportes/ventas-diarias`
Una fila por día con ventas, ordenado por fecha.
```json
[ { "fecha": "2026-09-30", "ventas_taquilla": 3, "ventas_web": 2, "entradas": 11,
    "subtotal": 360.00, "descuento": 18.00, "total": 342.00 } ]
```

### `GET /reportes/por-tipo`
Una fila por tipo de entrada vendido, de mayor a menor total.
```json
[ { "tipo_entrada": "Adulto", "cantidad": 5, "usadas": 3, "subtotal": 200.00, "descuento": 12.00, "total": 188.00, "porcentaje": 55.3 } ]
```
`porcentaje` = total del tipo / total del periodo × 100, con 1 decimal.

### `GET /reportes/promociones`
Una fila por promoción usada en el periodo.
```json
[ { "promocion": "Paquete familiar", "codigo": null, "descuento_porcentaje": 15.00,
    "compras": 1, "entradas": 4, "descuento_total": 18.00 } ]
```

---

## Tarjetas del inicio (`index.js → resumenDashboard(usuario, puede)`)
Devuelve un arreglo de tarjetas como los demás módulos, por ejemplo:
- "Ingresos de hoy" (`Q…`, `bi-cash-stack`, enlace a `/app/entradas/ventas.html`), si `puede('entradas.ventas.ver')`.
- "Visitantes que ingresaron hoy" (`bi-person-check`, enlace a `/app/entradas/validar.html`), si `puede('entradas.validar')`.
