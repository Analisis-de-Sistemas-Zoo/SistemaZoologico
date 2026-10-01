/**
 * Modelo de usuarios: solo consultas SQL, sin lógica de HTTP.
 */
const db = require('../../config/db');

const CAMPOS = `
  u.id, u.nombres, u.apellidos, u.usuario, u.correo, u.activo, u.rol_id,
  r.codigo AS rol, r.nombre AS rol_nombre, u.ultimo_acceso, u.creado_en,
  (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado`;

async function listar({ buscar, rolId, activo } = {}) {
  const condiciones = [];
  const parametros = [];

  if (buscar) {
    condiciones.push(`(CONCAT(u.nombres, ' ', u.apellidos) LIKE ? OR u.usuario LIKE ? OR u.correo LIKE ?)`);
    const patron = `%${buscar}%`;
    parametros.push(patron, patron, patron);
  }
  if (rolId) {
    condiciones.push('u.rol_id = ?');
    parametros.push(rolId);
  }
  if (activo !== undefined && activo !== null && activo !== '') {
    condiciones.push('u.activo = ?');
    parametros.push(Number(activo));
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return db.query(
    `SELECT ${CAMPOS} FROM usuario u JOIN rol r ON r.id = u.rol_id ${where} ORDER BY u.activo DESC, u.nombres`,
    parametros
  );
}

function obtener(id) {
  return db.queryUno(`SELECT ${CAMPOS} FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ?`, [id]);
}

async function crear({ rol_id, nombres, apellidos, usuario, correo, password_hash }) {
  const resultado = await db.query(
    `INSERT INTO usuario (rol_id, nombres, apellidos, usuario, correo, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rol_id, nombres, apellidos, usuario, correo, password_hash]
  );
  return resultado.insertId;
}

function actualizar(id, { rol_id, nombres, apellidos, usuario, correo }) {
  return db.query(
    'UPDATE usuario SET rol_id = ?, nombres = ?, apellidos = ?, usuario = ?, correo = ? WHERE id = ?',
    [rol_id, nombres, apellidos, usuario, correo, id]
  );
}

function cambiarEstado(id, activo) {
  return db.query(
    'UPDATE usuario SET activo = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
    [activo ? 1 : 0, id]
  );
}

function cambiarPassword(id, passwordHash) {
  return db.query(
    'UPDATE usuario SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
    [passwordHash, id]
  );
}

function listarRoles() {
  return db.query('SELECT id, codigo, nombre, descripcion FROM rol ORDER BY id');
}

function existeRol(id) {
  return db.queryUno('SELECT id FROM rol WHERE id = ?', [id]);
}

/** Usuarios activos de uno o varios roles (para selects en los módulos). */
function listarPorRoles(codigosRol) {
  return db.query(
    `SELECT u.id, CONCAT(u.nombres, ' ', u.apellidos) AS nombre, r.codigo AS rol
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.activo = 1 AND r.codigo IN (?)
      ORDER BY u.nombres`,
    [codigosRol]
  );
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  cambiarPassword,
  listarRoles,
  existeRol,
  listarPorRoles,
};
