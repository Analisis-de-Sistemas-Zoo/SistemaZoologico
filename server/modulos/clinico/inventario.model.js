/**
 * Modelo del inventario clínico (medicamentos, vacunas y vitaminas).
 * EJEMPLO COMPLETO: esta parte del módulo ya funciona de punta a punta.
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
};

module.exports = inventario;
