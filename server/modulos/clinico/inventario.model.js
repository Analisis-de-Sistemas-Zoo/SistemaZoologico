/**
 * Modelo del inventario clínico (medicamentos, vacunas y vitaminas).
 *
 * La existencia NUNCA se edita a mano: solo cambia por movimientos (entradas,
 * mermas) y por las aplicaciones registradas en una consulta o una vacunación.
 */
const db = require('../../config/db');

const inventario = {
  listar({ buscar, tipo, activo, bajo_minimo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(i.nombre LIKE ? OR i.presentacion LIKE ? OR i.enfermedad_previene LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (tipo) { condiciones.push('i.tipo = ?'); parametros.push(tipo); }
    if (activo !== undefined && activo !== null && activo !== '') {
      condiciones.push('i.activo = ?');
      parametros.push(Number(activo));
    }
    if (bajo_minimo === '1') condiciones.push('i.stock_actual <= i.stock_minimo');
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(
      `SELECT i.*, (i.stock_actual <= i.stock_minimo) AS bajo_minimo
         FROM insumo_clinico i ${where}
        ORDER BY i.activo DESC, FIELD(i.tipo, 'medicamento', 'vacuna', 'vitamina'), i.nombre`,
      parametros
    );
  },

  obtener: (id) =>
    db.queryUno('SELECT i.*, (i.stock_actual <= i.stock_minimo) AS bajo_minimo FROM insumo_clinico i WHERE i.id = ?', [id]),

  async crear(d) {
    const r = await db.query(
      `INSERT INTO insumo_clinico (tipo, nombre, presentacion, unidad_medida, stock_actual, stock_minimo,
                                   dosis_recomendada, enfermedad_previene, intervalo_refuerzo_dias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.tipo, d.nombre, d.presentacion ?? '', d.unidad_medida, d.stock_actual ?? 0, d.stock_minimo ?? 0,
        d.dosis_recomendada, d.enfermedad_previene, d.intervalo_refuerzo_dias]
    );
    return r.insertId;
  },

  /** La existencia no se edita aquí: cambia solo con movimientos y aplicaciones. */
  actualizar: (id, d) =>
    db.query(
      `UPDATE insumo_clinico SET tipo = ?, nombre = ?, presentacion = ?, unidad_medida = ?, stock_minimo = ?,
              dosis_recomendada = ?, enfermedad_previene = ?, intervalo_refuerzo_dias = ?
        WHERE id = ?`,
      [d.tipo, d.nombre, d.presentacion ?? '', d.unidad_medida, d.stock_minimo ?? 0,
        d.dosis_recomendada, d.enfermedad_previene, d.intervalo_refuerzo_dias, id]
    ),

  cambiarEstado: (id, activo) => db.query('UPDATE insumo_clinico SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),

  /**
   * Historial del producto, del más reciente al más antiguo.
   * `animal` es el de la aplicación que originsó la salida; queda NULL en
   * entradas y mermas.
   */
  movimientos(id) {
    return db.query(
      `SELECT m.id, m.tipo, m.cantidad, m.aplicacion_id, an.nombre AS animal, m.numero_lote,
              m.fecha_vencimiento, m.motivo, CONCAT(u.nombres, ' ', u.apellidos) AS usuario, m.fecha
         FROM movimiento_clinico m
         JOIN usuario u ON u.id = m.usuario_id
         LEFT JOIN aplicacion_clinica ap ON ap.id = m.aplicacion_id
         LEFT JOIN animal an ON an.id = ap.animal_id
        WHERE m.insumo_clinico_id = ?
        ORDER BY m.fecha DESC, m.id DESC`,
      [id]
    );
  },

  /** Registra una entrada o una merma. El stock lo ajusta el controlador en la misma transacción. */
  crearMovimiento(d, conn = db) {
    return conn.query(
      `INSERT INTO movimiento_clinico
         (insumo_clinico_id, tipo, cantidad, aplicacion_id, numero_lote, fecha_vencimiento, motivo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.insumo_clinico_id, d.tipo, d.cantidad, d.aplicacion_id ?? null, d.numero_lote ?? null,
        d.fecha_vencimiento ?? null, d.motivo ?? null, d.usuario_id]
    );
  },

  /**
   * Resta existencia de forma segura. El `AND stock_actual >= ?` evita que dos
   * mermas simultáneas dejen la existencia negativa: la que pierda la carrera
   * recibe affectedRows = 0 y el controlador responde 409.
   */
  restarStock: (id, cantidad, conn = db) =>
    conn.query('UPDATE insumo_clinico SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?', [
      cantidad, id, cantidad,
    ]),

  sumarStock: (id, cantidad, conn = db) =>
    conn.query('UPDATE insumo_clinico SET stock_actual = stock_actual + ? WHERE id = ?', [cantidad, id]),

  /** Productos activos que llegaron a su existencia mínima o se agotaron. */
  contarBajoMinimo() {
    return db
      .queryUno('SELECT COUNT(*) AS total FROM insumo_clinico WHERE activo = 1 AND stock_actual <= stock_minimo')
      .then((f) => Number(f.total));
  },
};

module.exports = inventario;
