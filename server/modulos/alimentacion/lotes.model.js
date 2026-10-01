/**
 * Modelo de lotes de alimento (cada entrada por compra) y sus movimientos.
 */
const db = require('../../config/db');
const { SELECT_MOVIMIENTO } = require('./alimentos.model');

const SELECT_LOTE = `
  SELECT * FROM (
    SELECT l.*, a.nombre AS alimento, a.categoria, a.unidad_medida, a.dias_aviso_vencimiento,
           p.nombre AS proveedor, CONCAT(u.nombres, ' ', u.apellidos) AS registrado_por,
           ROUND(l.cantidad_inicial - l.cantidad_disponible, 3)      AS cantidad_usada,
           ROUND(l.cantidad_inicial * COALESCE(l.costo_unitario, 0), 2) AS costo_total,
           DATEDIFF(l.fecha_vencimiento, CURDATE())                  AS dias_para_vencer,
           CASE
             WHEN l.cantidad_disponible = 0 THEN 'agotado'
             WHEN l.fecha_vencimiento < CURDATE() THEN 'vencido'
             WHEN l.fecha_vencimiento <= CURDATE() + INTERVAL a.dias_aviso_vencimiento DAY THEN 'por_vencer'
             ELSE 'disponible'
           END AS estado
      FROM lote_alimento l
      JOIN alimento a ON a.id = l.alimento_id
      JOIN proveedor p ON p.id = l.proveedor_id
      JOIN usuario u ON u.id = l.usuario_id
  ) x`;

const lotes = {
  listar({ alimento_id, proveedor_id, estado, desde, hasta, buscar } = {}) {
    const condiciones = [];
    const parametros = [];
    if (alimento_id) { condiciones.push('x.alimento_id = ?'); parametros.push(Number(alimento_id)); }
    if (proveedor_id) { condiciones.push('x.proveedor_id = ?'); parametros.push(Number(proveedor_id)); }
    if (estado === 'con_existencia') condiciones.push("x.estado IN ('disponible', 'por_vencer')");
    else if (estado) { condiciones.push('x.estado = ?'); parametros.push(estado); }
    if (desde) { condiciones.push('x.fecha_ingreso >= ?'); parametros.push(desde); }
    if (hasta) { condiciones.push('x.fecha_ingreso <= ?'); parametros.push(hasta); }
    if (buscar) {
      condiciones.push('(x.numero_lote LIKE ? OR x.numero_factura LIKE ? OR x.alimento LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(
      `${SELECT_LOTE} ${where}
       ORDER BY FIELD(x.estado, 'vencido', 'por_vencer', 'disponible', 'agotado'), x.fecha_vencimiento IS NULL, x.fecha_vencimiento, x.id DESC
       LIMIT 500`,
      parametros
    );
  },

  obtener: (id) => db.queryUno(`${SELECT_LOTE} WHERE x.id = ?`, [id]),

  existeNumero: (alimentoId, numeroLote, excluirId = 0) =>
    db.queryUno('SELECT id FROM lote_alimento WHERE alimento_id = ? AND numero_lote = ? AND id <> ?', [alimentoId, numeroLote, excluirId]),

  /** Entrada por compra: crea el lote y su movimiento de entrada. */
  async crear(d, usuarioId, conn) {
    const r = await conn.query(
      `INSERT INTO lote_alimento (alimento_id, proveedor_id, numero_lote, numero_factura, fecha_ingreso, fecha_vencimiento,
                                  cantidad_inicial, cantidad_disponible, costo_unitario, usuario_id, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.alimento_id, d.proveedor_id, d.numero_lote, d.numero_factura, d.fecha_ingreso, d.fecha_vencimiento,
        d.cantidad, d.cantidad, d.costo_unitario, usuarioId, d.observaciones]
    );
    await conn.query(
      `INSERT INTO movimiento_alimento (lote_id, tipo, cantidad, motivo, usuario_id, fecha)
       VALUES (?, 'entrada', ?, ?, ?, NOW())`,
      [r.insertId, d.cantidad, d.numero_factura ? `Compra, factura ${d.numero_factura}` : 'Compra', usuarioId]
    );
    return r.insertId;
  },

  /** Solo datos del documento; el alimento y las cantidades no se editan. */
  actualizar: (id, d) =>
    db.query(
      `UPDATE lote_alimento SET proveedor_id = ?, numero_lote = ?, numero_factura = ?, fecha_ingreso = ?,
              fecha_vencimiento = ?, costo_unitario = ?, observaciones = ?
        WHERE id = ?`,
      [d.proveedor_id, d.numero_lote, d.numero_factura, d.fecha_ingreso, d.fecha_vencimiento, d.costo_unitario, d.observaciones, id]
    ),

  /** Bloquea el lote dentro de la transacción para que nadie más lo descuente al mismo tiempo. */
  bloquear: (conn, id) => conn.queryUno('SELECT id, alimento_id, cantidad_disponible FROM lote_alimento WHERE id = ? FOR UPDATE', [id]),

  async registrarMerma(conn, loteId, cantidad, motivo, usuarioId) {
    await conn.query('UPDATE lote_alimento SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?', [cantidad, loteId]);
    const r = await conn.query(
      `INSERT INTO movimiento_alimento (lote_id, tipo, cantidad, motivo, usuario_id, fecha)
       VALUES (?, 'merma', ?, ?, ?, NOW())`,
      [loteId, cantidad, motivo, usuarioId]
    );
    return r.insertId;
  },

  movimientos: (loteId) => db.query(`${SELECT_MOVIMIENTO} WHERE m.lote_id = ? ORDER BY m.fecha DESC, m.id DESC`, [loteId]),
};

module.exports = lotes;
