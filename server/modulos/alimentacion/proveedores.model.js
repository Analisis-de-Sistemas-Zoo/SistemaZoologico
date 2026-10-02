/**
 * Modelo de proveedores de alimentos, con un resumen de sus compras.
 */
const db = require('../../config/db');

const SELECT_PROVEEDOR = `
  SELECT p.*,
         COUNT(l.id)                                                     AS compras,
         MAX(l.fecha_ingreso)                                            AS ultima_compra,
         ROUND(COALESCE(SUM(l.cantidad_inicial * COALESCE(l.costo_unitario, 0)), 0), 2) AS total_comprado
    FROM proveedor p
    LEFT JOIN lote_alimento l ON l.proveedor_id = p.id`;

const proveedores = {
  listar({ buscar, activo } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(p.nombre LIKE ? OR p.nit LIKE ? OR p.contacto LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (activo !== undefined && activo !== null && activo !== '') { condiciones.push('p.activo = ?'); parametros.push(Number(activo)); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    return db.query(`${SELECT_PROVEEDOR} ${where} GROUP BY p.id ORDER BY p.activo DESC, p.nombre`, parametros);
  },

  obtener: (id) => db.queryUno(`${SELECT_PROVEEDOR} WHERE p.id = ? GROUP BY p.id`, [id]),

  duplicado: (campo, valor, excluirId = 0) =>
    db.queryUno(`SELECT id FROM proveedor WHERE ${campo === 'nit' ? 'nit' : 'nombre'} = ? AND id <> ?`, [valor, excluirId]),

  async crear(d) {
    const r = await db.query(
      'INSERT INTO proveedor (nombre, nit, contacto, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?, ?)',
      [d.nombre, d.nit, d.contacto, d.telefono, d.correo, d.direccion]
    );
    return r.insertId;
  },

  actualizar: (id, d) =>
    db.query(
      'UPDATE proveedor SET nombre = ?, nit = ?, contacto = ?, telefono = ?, correo = ?, direccion = ? WHERE id = ?',
      [d.nombre, d.nit, d.contacto, d.telefono, d.correo, d.direccion, id]
    ),

  cambiarEstado: (id, activo) => db.query('UPDATE proveedor SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),
};

module.exports = proveedores;
