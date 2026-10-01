/**
 * Consulta de la bitácora (administrador y director).
 */
const db = require('../../config/db');
const { ok } = require('../../utils/respuesta');
const bitacora = require('./bitacora.service');

const MAX_EXPORTAR = 5000;

function construirFiltros({ desde, hasta, usuario_id, modulo, accion }) {
  const condiciones = [];
  const parametros = [];
  if (desde) { condiciones.push('b.fecha >= ?'); parametros.push(`${desde} 00:00:00`); }
  if (hasta) { condiciones.push('b.fecha <= ?'); parametros.push(`${hasta} 23:59:59`); }
  if (usuario_id) { condiciones.push('b.usuario_id = ?'); parametros.push(usuario_id); }
  if (modulo) { condiciones.push('b.modulo = ?'); parametros.push(modulo); }
  if (accion) { condiciones.push('b.accion = ?'); parametros.push(accion); }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', parametros };
}

async function listar(req, res) {
  const filtros = req.query;
  const exportar = filtros.exportar === '1';
  const pagina = Math.max(1, Number(filtros.pagina) || 1);
  const limite = exportar ? MAX_EXPORTAR : Math.min(100, Math.max(5, Number(filtros.limite) || 25));
  const { where, parametros } = construirFiltros(filtros);

  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM bitacora b ${where}`, parametros);
  const filas = await db.query(
    `SELECT b.id, b.fecha, b.modulo, b.accion, b.tabla_afectada, b.registro_id, b.detalle, b.ip,
            u.usuario, CONCAT(u.nombres, ' ', u.apellidos) AS nombre_usuario
       FROM bitacora b LEFT JOIN usuario u ON u.id = b.usuario_id
       ${where}
      ORDER BY b.fecha DESC, b.id DESC
      LIMIT ? OFFSET ?`,
    [...parametros, limite, exportar ? 0 : (pagina - 1) * limite]
  );

  if (exportar) {
    await bitacora.registrar(req, {
      modulo: 'bitacora',
      accion: bitacora.ACCIONES.EXPORTAR,
      detalle: { filtros: { ...filtros, exportar: undefined }, registros: filas.length },
    });
  }

  return ok(res, { filas, total, pagina, limite });
}

async function filtros(_req, res) {
  const [modulos, acciones, usuarios] = await Promise.all([
    db.query('SELECT DISTINCT modulo FROM bitacora ORDER BY modulo'),
    db.query('SELECT DISTINCT accion FROM bitacora ORDER BY accion'),
    db.query(`SELECT id, usuario, CONCAT(nombres, ' ', apellidos) AS nombre FROM usuario ORDER BY nombres`),
  ]);
  return ok(res, {
    modulos: modulos.map((m) => m.modulo),
    acciones: acciones.map((a) => a.accion),
    usuarios,
  });
}

module.exports = { listar, filtros };
