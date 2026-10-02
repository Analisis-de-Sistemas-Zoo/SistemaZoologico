/**
 * Modelo de tipos de entrada y promociones.
 * EJEMPLO COMPLETO: esta parte del módulo ya funciona de punta a punta.
 */
const db = require('../../config/db');

const tipos = {
  listar({ activo } = {}) {
    const filtro = activo !== undefined && activo !== null && activo !== '' ? 'WHERE activo = ?' : '';
    return db.query(`SELECT * FROM tipo_entrada ${filtro} ORDER BY activo DESC, precio DESC, nombre`, filtro ? [Number(activo)] : []);
  },
  obtener: (id) => db.queryUno('SELECT * FROM tipo_entrada WHERE id = ?', [id]),
  async crear(d) {
    const r = await db.query('INSERT INTO tipo_entrada (nombre, descripcion, precio) VALUES (?, ?, ?)', [d.nombre, d.descripcion, d.precio]);
    return r.insertId;
  },
  actualizar: (id, d) =>
    db.query('UPDATE tipo_entrada SET nombre = ?, descripcion = ?, precio = ? WHERE id = ?', [d.nombre, d.descripcion, d.precio, id]),
  cambiarEstado: (id, activo) => db.query('UPDATE tipo_entrada SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]),
};

const CAMPOS_PROMOCION = `
  p.*, t.nombre AS tipo_entrada,
  CASE
    WHEN p.activa = 0 THEN 'inactiva'
    WHEN CURDATE() < p.fecha_inicio THEN 'programada'
    WHEN CURDATE() > p.fecha_fin THEN 'vencida'
    ELSE 'vigente'
  END AS vigencia`;

const promociones = {
  listar({ vigencia, buscar } = {}) {
    const condiciones = [];
    const parametros = [];
    if (buscar) {
      condiciones.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
      parametros.push(`%${buscar}%`, `%${buscar}%`);
    }
    let sql = `SELECT ${CAMPOS_PROMOCION} FROM promocion p LEFT JOIN tipo_entrada t ON t.id = p.tipo_entrada_id`;
    if (condiciones.length) sql += ` WHERE ${condiciones.join(' AND ')}`;
    sql = `SELECT * FROM (${sql}) x ${vigencia ? 'WHERE vigencia = ?' : ''} ORDER BY FIELD(vigencia, 'vigente', 'programada', 'vencida', 'inactiva'), fecha_inicio DESC`;
    if (vigencia) parametros.push(vigencia);
    return db.query(sql, parametros);
  },
  obtener: (id) =>
    db.queryUno(`SELECT ${CAMPOS_PROMOCION} FROM promocion p LEFT JOIN tipo_entrada t ON t.id = p.tipo_entrada_id WHERE p.id = ?`, [id]),
  async crear(d) {
    const r = await db.query(
      `INSERT INTO promocion (nombre, descripcion, descuento_porcentaje, tipo_entrada_id, cantidad_minima, codigo, fecha_inicio, fecha_fin, publicada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.nombre, d.descripcion, d.descuento_porcentaje, d.tipo_entrada_id, d.cantidad_minima ?? 1, d.codigo, d.fecha_inicio, d.fecha_fin, d.publicada ? 1 : 0]
    );
    return r.insertId;
  },
  actualizar: (id, d) =>
    db.query(
      `UPDATE promocion SET nombre = ?, descripcion = ?, descuento_porcentaje = ?, tipo_entrada_id = ?, cantidad_minima = ?,
              codigo = ?, fecha_inicio = ?, fecha_fin = ?, publicada = ?
        WHERE id = ?`,
      [d.nombre, d.descripcion, d.descuento_porcentaje, d.tipo_entrada_id, d.cantidad_minima ?? 1, d.codigo, d.fecha_inicio, d.fecha_fin, d.publicada ? 1 : 0, id]
    ),
  cambiarEstado: (id, activa) => db.query('UPDATE promocion SET activa = ? WHERE id = ?', [activa ? 1 : 0, id]),

  /** Promociones que el portal muestra: activas, publicadas y vigentes hoy o próximamente. Sin códigos de cupón. */
  publicas: () =>
    db.query(
      `SELECT p.id, p.nombre, p.descripcion, p.descuento_porcentaje, p.cantidad_minima, p.fecha_inicio, p.fecha_fin AS vigente_hasta,
              t.nombre AS tipo_entrada, (p.codigo IS NOT NULL) AS requiere_cupon
         FROM promocion p LEFT JOIN tipo_entrada t ON t.id = p.tipo_entrada_id
        WHERE p.activa = 1 AND p.publicada = 1 AND p.fecha_fin >= CURDATE()
        ORDER BY p.fecha_inicio, p.descuento_porcentaje DESC`
    ),
};

module.exports = { tipos, promociones };
