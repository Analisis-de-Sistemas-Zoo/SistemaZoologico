/**
 * Servicio de bitácora (auditoría). Todos los módulos lo usan para dejar
 * constancia de cada cambio con el usuario, la fecha, la hora y la IP.
 *
 * Uso en un controlador:
 *   const bitacora = require('../../core/bitacora/bitacora.service');
 *
 *   await bitacora.registrar(req, {
 *     modulo: 'alimentacion',
 *     accion: bitacora.ACCIONES.CREAR,
 *     tabla: 'dieta',
 *     registroId: nuevoId,
 *     detalle: { especie_id, producto_id, cantidad },   // texto u objeto
 *   });
 *
 * Dentro de una transacción pasa `conn` como tercer parámetro para que el
 * registro de bitácora se guarde (o se revierta) junto con el cambio.
 */
const db = require('../../config/db');

const ACCIONES = Object.freeze({
  CREAR: 'CREAR',
  ACTUALIZAR: 'ACTUALIZAR',
  ELIMINAR: 'ELIMINAR',
  ACTIVAR: 'ACTIVAR',
  DESACTIVAR: 'DESACTIVAR',
  LOGIN: 'LOGIN',
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  BLOQUEO: 'BLOQUEO',
  LOGOUT: 'LOGOUT',
  CAMBIO_PASSWORD: 'CAMBIO_PASSWORD',
  EXPORTAR: 'EXPORTAR',
  ACCESO_DENEGADO: 'ACCESO_DENEGADO',
});

function obtenerIp(req) {
  return (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '').slice(0, 45);
}

async function registrar(req, { modulo, accion, tabla = null, registroId = null, detalle = null, usuarioId }, conn = null) {
  const ejecutor = conn || db;
  const idUsuario = usuarioId !== undefined ? usuarioId : req.session?.usuario?.id || null;
  const textoDetalle = detalle == null ? null : typeof detalle === 'string' ? detalle : JSON.stringify(detalle);

  try {
    await ejecutor.query(
      `INSERT INTO bitacora (usuario_id, modulo, accion, tabla_afectada, registro_id, detalle, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idUsuario, modulo, accion, tabla, registroId == null ? null : String(registroId), textoDetalle, obtenerIp(req)]
    );
  } catch (error) {
    // Dentro de una transacción el error debe propagarse para revertir todo.
    if (conn) throw error;
    console.error('[bitacora] No se pudo registrar la acción:', error.message);
  }
}

module.exports = { registrar, ACCIONES, obtenerIp };
