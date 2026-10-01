/**
 * Modelo de insumos de limpieza.
 * EJEMPLO COMPLETO: esta parte del módulo ya funciona de punta a punta.
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
};

module.exports = insumos;
