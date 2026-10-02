/**
 * Consultas base del módulo de entradas.
 * Las usa ventas.controller.js (ver docs/api/entradas.md → "Objetos").
 *
 * Estilo: una función por operación, siempre con `?` para los valores.
 * Las que forman parte de una transacción reciben `conn` como último parámetro.
 */
const db = require('../../config/db');

/** Encabezado de una venta (compra). */
const SELECT_VENTA = `
  SELECT c.id, c.codigo, c.canal, c.fecha, c.fecha_visita, c.subtotal, c.descuento, c.total,
         c.metodo_pago, c.referencia_pago, c.estado, c.motivo_anulacion, c.fecha_anulacion,
         c.cliente_id, cl.nombre AS cliente, cl.correo AS cliente_correo, cl.nit AS cliente_nit,
         c.vendedor_id, CONCAT(uv.nombres, ' ', uv.apellidos) AS vendedor,
         CONCAT(ua.nombres, ' ', ua.apellidos) AS anulado_por,
         (SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_compra d WHERE d.compra_id = c.id) AS cantidad_entradas
    FROM compra c
    LEFT JOIN cliente cl ON cl.id = c.cliente_id
    LEFT JOIN usuario uv ON uv.id = c.vendedor_id
    LEFT JOIN usuario ua ON ua.id = c.anulado_por_id`;

/** Líneas de una venta. */
const SELECT_DETALLE = `
  SELECT d.id, d.tipo_entrada_id, t.nombre AS tipo_entrada, d.cantidad, d.precio_unitario,
         d.promocion_id, p.nombre AS promocion, d.descuento, d.subtotal
    FROM detalle_compra d
    JOIN tipo_entrada t ON t.id = d.tipo_entrada_id
    LEFT JOIN promocion p ON p.id = d.promocion_id
   WHERE d.compra_id = ?
   ORDER BY d.id`;

/** Entradas (boletos) de una venta. */
const SELECT_ENTRADAS = `
  SELECT e.id, e.codigo_qr, t.nombre AS tipo_entrada, e.estado, e.fecha_uso
    FROM entrada e
    JOIN detalle_compra d ON d.id = e.detalle_id
    JOIN tipo_entrada t ON t.id = d.tipo_entrada_id
   WHERE d.compra_id = ?
   ORDER BY e.id`;

/** 'WHERE ...' de las ventas pagadas dentro de un periodo (para los reportes). */
const wherePeriodo = ({ desde, hasta }, prefijo = 'c') => {
  const partes = [`${prefijo}.estado = 'pagada'`];
  const valores = [];
  if (desde) partes.push(`DATE(${prefijo}.fecha) >= ?`), valores.push(desde);
  if (hasta) partes.push(`DATE(${prefijo}.fecha) <= ?`), valores.push(hasta);
  return { texto: `WHERE ${partes.join(' AND ')}`, valores };
};

// ============================================================== Cotización
const tiposDe = (ids) =>
  db.query(`SELECT id, nombre, precio FROM tipo_entrada WHERE activo = 1 AND id IN (${ids.map(() => '?').join(',')})`, ids);

const promocionesVigentes = (fecha_visita) =>
  db.query(
    `SELECT id, nombre, descuento_porcentaje, tipo_entrada_id, cantidad_minima, codigo
       FROM promocion
      WHERE activa = 1 AND fecha_inicio <= ? AND fecha_fin >= ?`,
    [fecha_visita, fecha_visita]
  );

// ================================================================ Clientes
const clientePorCorreo = (correo) => db.queryUno('SELECT * FROM cliente WHERE correo = ?', [correo]);

const crearCliente = (d, conn = db) =>
  conn.query('INSERT INTO cliente (nombre, correo, telefono, nit) VALUES (?, ?, ?, ?)', [
    d.nombre, d.correo, d.telefono || null, d.nit || 'CF',
  ]);

const actualizarCliente = (id, d, conn = db) =>
  conn.query('UPDATE cliente SET nombre = ?, telefono = ?, nit = ? WHERE id = ?', [
    d.nombre, d.telefono || null, d.nit || 'CF', id,
  ]);

// ================================================================== Ventas
/** Inserta la compra con un código provisional y devuelve su id (el código se arma después). */
const insertarCompra = (d, conn = db) =>
  conn.query(
    `INSERT INTO compra
       (codigo, canal, cliente_id, vendedor_id, fecha_visita, subtotal, descuento, total, metodo_pago, referencia_pago)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.codigo, d.canal, d.cliente_id ?? null, d.vendedor_id ?? null, d.fecha_visita,
     d.subtotal, d.descuento, d.total, d.metodo_pago, d.referencia_pago ?? null]
  ).then((r) => r.insertId);

const actualizarCodigoCompra = (id, codigo, conn = db) =>
  conn.query('UPDATE compra SET codigo = ? WHERE id = ?', [codigo, id]);

const insertarDetalle = (d, conn = db) =>
  conn.query(
    `INSERT INTO detalle_compra (compra_id, tipo_entrada_id, promocion_id, cantidad, precio_unitario, descuento, subtotal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [d.compra_id, d.tipo_entrada_id, d.promocion_id ?? null, d.cantidad, d.precio_unitario, d.descuento, d.subtotal]
  ).then((r) => r.insertId);

/** Una fila de `entrada` por unidad vendida. */
const insertarEntrada = (detalle_id, codigo_qr, conn = db) =>
  conn.query(`INSERT INTO entrada (detalle_id, codigo_qr, estado) VALUES (?, ?, 'vigente')`, [detalle_id, codigo_qr]);

// ================================================================= Consultas
const ventaPorId = (id) => db.queryUno(`${SELECT_VENTA} WHERE c.id = ?`, [id]);

/** Compra indicada por su código, solo si el cliente tiene ese correo. */
const ventaPorCodigoYCorreo = (codigo, correo) =>
  db.queryUno(`${SELECT_VENTA} WHERE c.codigo = ? AND cl.correo = ?`, [codigo, correo]);

const listarVentas = ({ desde, hasta, canal, estado, buscar } = {}) => {
  const partes = [];
  const valores = [];
  if (desde) partes.push('DATE(c.fecha) >= ?'), valores.push(desde);
  if (hasta) partes.push('DATE(c.fecha) <= ?'), valores.push(hasta);
  if (canal) partes.push('c.canal = ?'), valores.push(canal);
  if (estado) partes.push('c.estado = ?'), valores.push(estado);
  if (buscar) {
    partes.push('(c.codigo LIKE ? OR cl.nombre LIKE ? OR cl.nit LIKE ?)');
    valores.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  const where = partes.length ? `WHERE ${partes.join(' AND ')}` : '';
  return db.query(`${SELECT_VENTA} ${where} ORDER BY c.fecha DESC, c.id DESC`, valores);
};

const detalle = (compra_id) => db.query(SELECT_DETALLE, [compra_id]);

const entradas = (compra_id) => db.query(SELECT_ENTRADAS, [compra_id]);

// ================================================================ Anulación
const anularCompra = (id, motivo, usuarioId, conn = db) =>
  conn.query(`UPDATE compra SET estado = 'anulada', motivo_anulacion = ?, anulado_por_id = ?, fecha_anulacion = NOW()
               WHERE id = ?`, [motivo, usuarioId, id]);

const anularEntradas = (compra_id, conn = db) =>
  conn.query(
    `UPDATE entrada e
       JOIN detalle_compra d ON d.id = e.detalle_id
      SET e.estado = 'anulada'
     WHERE d.compra_id = ? AND e.estado = 'vigente'`,
    [compra_id]
  );

const contarEntradasUsadas = (compra_id) =>
  db.queryUno(
    `SELECT COUNT(*) AS total FROM entrada e
       JOIN detalle_compra d ON d.id = e.detalle_id
      WHERE d.compra_id = ? AND e.estado = 'usada'`,
    [compra_id]
  ).then((r) => Number(r?.total || 0));

// ============================================================== Validación
/** Datos completos de una entrada para mostrarlos al validarla. */
const buscarEntrada = (codigo_qr) =>
  db.queryUno(
    `SELECT e.id, e.codigo_qr, e.estado, e.fecha_uso, e.validador_id,
            t.nombre AS tipo_entrada,
            c.id AS compra_id, c.codigo AS compra_codigo, c.fecha_visita, c.estado AS compra_estado,
            cl.nombre AS cliente, cl.correo AS cliente_correo
       FROM entrada e
       JOIN detalle_compra d ON d.id = e.detalle_id
       JOIN compra c ON c.id = d.compra_id
       JOIN tipo_entrada t ON t.id = d.tipo_entrada_id
       LEFT JOIN cliente cl ON cl.id = c.cliente_id
      WHERE e.codigo_qr = ?`,
    [codigo_qr]
  );

/** Marca la entrada como usada. Devuelve false si otro lector se adelantó. */
const marcarEntradaUsada = (id, validadorId, conn = db) =>
  conn
    .query(`UPDATE entrada SET estado = 'usada', fecha_uso = NOW(), validador_id = ? WHERE id = ? AND estado = 'vigente'`, [
      validadorId, id,
    ])
    .then((r) => r.affectedRows > 0);

/** Entradas no anuladas de compras pagadas cuya fecha de visita es hoy. */
const resumenIngresosHoy = () =>
  db.queryUno(
    `SELECT COUNT(*) AS entradas_del_dia,
            COALESCE(SUM(e.estado = 'usada'), 0) AS ingresados
       FROM entrada e
       JOIN detalle_compra d ON d.id = e.detalle_id
       JOIN compra c ON c.id = d.compra_id
      WHERE c.fecha_visita = CURDATE() AND c.estado = 'pagada' AND e.estado <> 'anulada'`
  );

const ultimasValidaciones = (limite = 10) =>
  db.query(
    `SELECT e.fecha_uso, t.nombre AS tipo_entrada, c.codigo AS compra_codigo,
            CONCAT(uv.nombres, ' ', uv.apellidos) AS validador
       FROM entrada e
       JOIN detalle_compra d ON d.id = e.detalle_id
       JOIN compra c ON c.id = d.compra_id
       JOIN tipo_entrada t ON t.id = d.tipo_entrada_id
       LEFT JOIN usuario uv ON uv.id = e.validador_id
      WHERE e.estado = 'usada' AND DATE(e.fecha_uso) = CURDATE()
      ORDER BY e.fecha_uso DESC
      LIMIT ?`,
    [limite]
  );

// ================================================================== Ventas hoy
const resumenVentasHoy = () =>
  db.queryUno(
    `SELECT COUNT(*) AS ventas,
            COALESCE(SUM(c.total), 0) AS ingresos,
            COALESCE(SUM(d.cantidad), 0) AS entradas
       FROM compra c
       LEFT JOIN detalle_compra d ON d.compra_id = c.id
      WHERE c.estado = 'pagada' AND DATE(c.fecha) = CURDATE()`
  );

// ================================================================= Reportes
const reporteVentasDiarias = (filtros) => {
  const { texto, valores } = wherePeriodo(filtros);
  return db.query(
    `SELECT DATE(c.fecha) AS fecha,
            SUM(c.canal = 'taquilla') AS ventas_taquilla,
            SUM(c.canal = 'web')       AS ventas_web,
            COALESCE(SUM(d.cantidad), 0) AS entradas,
            SUM(c.subtotal)  AS subtotal,
            SUM(c.descuento) AS descuento,
            SUM(c.total)     AS total
       FROM compra c
       LEFT JOIN detalle_compra d ON d.compra_id = c.id
       ${texto}
      GROUP BY DATE(c.fecha)
      ORDER BY fecha`,
    valores
  );
};

const reportePorTipo = (filtros) => {
  const { texto, valores } = wherePeriodo(filtros);
  return db.query(
    `SELECT t.nombre AS tipo_entrada,
            SUM(x.cantidad) AS cantidad,
            SUM(x.usadas)   AS usadas,
            SUM(x.bruto)    AS subtotal,
            SUM(x.descuento) AS descuento,
            SUM(x.neto)     AS total
       FROM (
            SELECT d.id, d.tipo_entrada_id, d.cantidad,
                   (SELECT COUNT(*) FROM entrada e WHERE e.detalle_id = d.id AND e.estado = 'usada') AS usadas,
                   (d.subtotal + d.descuento) AS bruto,
                   d.descuento, d.subtotal AS neto
              FROM detalle_compra d
              JOIN compra c ON c.id = d.compra_id
              ${texto}
            ) x
       JOIN tipo_entrada t ON t.id = x.tipo_entrada_id
      GROUP BY t.id, t.nombre
      ORDER BY total DESC`,
    valores
  );
};

const reportePromociones = (filtros) => {
  const { texto, valores } = wherePeriodo(filtros);
  return db.query(
    `SELECT p.nombre AS promocion, p.codigo, p.descuento_porcentaje,
            COUNT(DISTINCT d.compra_id) AS compras,
            SUM(d.cantidad)   AS entradas,
            SUM(d.descuento)  AS descuento_total
       FROM detalle_compra d
       JOIN compra c ON c.id = d.compra_id
       JOIN promocion p ON p.id = d.promocion_id
       ${texto}
      GROUP BY p.id, p.nombre, p.codigo, p.descuento_porcentaje
      ORDER BY descuento_total DESC`,
    valores
  );
};

module.exports = {
  SELECT_VENTA,
  SELECT_DETALLE,
  SELECT_ENTRADAS,
  // Cotización
  tiposDe,
  promocionesVigentes,
  // Clientes
  clientePorCorreo,
  crearCliente,
  actualizarCliente,
  // Ventas
  insertarCompra,
  actualizarCodigoCompra,
  insertarDetalle,
  insertarEntrada,
  // Consultas
  ventaPorId,
  ventaPorCodigoYCorreo,
  listarVentas,
  detalle,
  entradas,
  // Anulación
  anularCompra,
  anularEntradas,
  contarEntradasUsadas,
  // Validación
  buscarEntrada,
  marcarEntradaUsada,
  resumenIngresosHoy,
  ultimasValidaciones,
  resumenVentasHoy,
  // Reportes
  reporteVentasDiarias,
  reportePorTipo,
  reportePromociones,
};