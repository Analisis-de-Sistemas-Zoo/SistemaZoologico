/**
 * Modelo de insumos de limpieza.
 *
 * El stock NUNCA se edita a mano: solo cambia por movimientos (entradas, salidas
 * por tareas y mermas). Aquí están las consultas de ese historial y el reporte
 * de consumo.
 */
const db = require('../../config/db');

const insumos = {
  listar({ buscar, activo, bajo_minimo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('i.nombre LIKE ?');
      parametros.push(`%${buscar}%`);
    }
    if (activo !== undefined && activo !== null && activo !== '') {
      condiciones.push('i.activo = ?');
      parametros.push(Number(activo));
    }
    if (bajo_minimo === '1') condiciones.push('i.stock_actual <= i.stock_minimo');
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(
      `SELECT i.*, (i.stock_actual <= i.stock_minimo) AS bajo_minimo
         FROM insumo_limpieza i ${where}
        ORDER BY i.activo DESC, bajo_minimo DESC, i.nombre`,
      parametros
    );
  },

  obtener: (id) =>
    db.queryUno('SELECT i.*, (i.stock_actual <= i.stock_minimo) AS bajo_minimo FROM insumo_limpieza i WHERE i.id = ?', [id]),

  async crear(d) {
    const r = await db.query(
      `INSERT INTO insumo_limpieza (nombre, unidad_medida, stock_actual, stock_minimo, descripcion)
       VALUES (?, ?, ?, ?, ?)`,
      [d.nombre, d.unidad_medida, d.stock_actual ?? 0, d.stock_minimo ?? 0, d.descripcion]
    );
    return r.insertId;
  },

  /** El stock no se edita aquí: cambia solo con movimientos (entradas, salidas y mermas). */
  actualizar: (id, d) =>
    db.query(
      'UPDATE insumo_limpieza SET nombre = ?, unidad_medida = ?, stock_minimo = ?, descripcion = ? WHERE id = ?',
      [d.nombre, d.unidad_medida, d.stock_minimo ?? 0, d.descripcion, id]
    ),

  cambiarEstado: (id, activo) => db.query('UPDATE insumo_limpieza SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),

  /**
   * Historial del insumo, del más reciente al más antiguo.
   * `area` es el área de la tarea que generó la salida; queda NULL en entradas y mermas.
   */
  movimientos(id) {
    return db.query(
      `SELECT m.id, m.tipo, m.cantidad, m.tarea_id, a.nombre AS area, m.motivo,
              CONCAT(u.nombres, ' ', u.apellidos) AS usuario, m.fecha
         FROM movimiento_insumo_limpieza m
         JOIN usuario u ON u.id = m.usuario_id
         LEFT JOIN tarea_limpieza t ON t.id = m.tarea_id
         LEFT JOIN area a ON a.id = t.area_id
        WHERE m.insumo_limpieza_id = ?
        ORDER BY m.fecha DESC, m.id DESC`,
      [id]
    );
  },

  /** Registra una entrada o una merma. No toca el stock: eso lo hace el controlador en la misma transacción. */
  crearMovimiento({ insumo_id, tipo, cantidad, motivo, usuario_id }, conn = db) {
    return conn.query(
      `INSERT INTO movimiento_insumo_limpieza (insumo_limpieza_id, tipo, cantidad, tarea_id, motivo, usuario_id)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [insumo_id, tipo, cantidad, motivo || null, usuario_id]
    );
  },

  /**
   * Resta stock de forma segura. El `AND stock_actual >= ?` evita que dos mermas
   * simultáneas dejen la existencia negativa: la que pierda la carrera recibe
   * affectedRows = 0 y el controlador responde 409.
   */
  restarStock: (id, cantidad, conn = db) =>
    conn.query('UPDATE insumo_limpieza SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?', [
      cantidad, id, cantidad,
    ]),

  sumarStock: (id, cantidad, conn = db) =>
    conn.query('UPDATE insumo_limpieza SET stock_actual = stock_actual + ? WHERE id = ?', [cantidad, id]),

  /** Insumos activos que llegaron a su existencia mínima o se agotaron. */
  contarBajoMinimo() {
    return db
      .queryUno('SELECT COUNT(*) AS total FROM insumo_limpieza WHERE activo = 1 AND stock_actual <= stock_minimo')
      .then((f) => Number(f.total));
  },

  /**
   * Consumo del periodo por insumo activo: cuántas entradas, salidas y mermas
   * hubo, más la existencia actual. Insumos sin movimientos en el periodo salen
   * igual con sus tres sumas en cero.
   */
  reporteConsumo({ desde, hasta }) {
    return db.query(
      `SELECT i.id AS insumo_limpieza_id, i.nombre, i.unidad_medida, i.stock_actual, i.stock_minimo,
              COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN m.tipo = 'salida'  THEN m.cantidad END), 0) AS salidas,
              COALESCE(SUM(CASE WHEN m.tipo = 'merma'   THEN m.cantidad END), 0) AS mermas
         FROM insumo_limpieza i
         LEFT JOIN movimiento_insumo_limpieza m
           ON m.insumo_limpieza_id = i.id AND DATE(m.fecha) BETWEEN ? AND ?
        WHERE i.activo = 1
        GROUP BY i.id, i.nombre, i.unidad_medida, i.stock_actual, i.stock_minimo
        ORDER BY i.nombre`,
      [desde, hasta]
    );
  },
};

module.exports = insumos;
