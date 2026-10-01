/**
 * Almacén de sesiones en MySQL (tabla `sesion`).
 * Las sesiones sobreviven a reinicios del servidor y el administrador puede
 * cerrar las sesiones de un usuario al desactivarlo.
 */
const session = require('express-session');
const db = require('../config/db');

class SesionStore extends session.Store {
  constructor({ duracionMs, limpiezaMs = 15 * 60 * 1000 } = {}) {
    super();
    this.duracionMs = duracionMs;
    this.temporizador = setInterval(() => this.limpiarExpiradas(), limpiezaMs);
    this.temporizador.unref();
  }

  expiracion(datos) {
    const ms = datos?.cookie?.expires ? new Date(datos.cookie.expires).getTime() : Date.now() + this.duracionMs;
    return new Date(ms);
  }

  get(sid, cb) {
    db.queryUno('SELECT datos FROM sesion WHERE sid = ? AND expira > NOW()', [sid])
      .then((fila) => cb(null, fila ? JSON.parse(fila.datos) : null))
      .catch(cb);
  }

  set(sid, datos, cb) {
    db.query(
      `INSERT INTO sesion (sid, usuario_id, expira, datos) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), expira = VALUES(expira), datos = VALUES(datos)`,
      [sid, datos?.usuario?.id || null, this.expiracion(datos), JSON.stringify(datos)]
    )
      .then(() => cb && cb(null))
      .catch((e) => cb && cb(e));
  }

  touch(sid, datos, cb) {
    db.query('UPDATE sesion SET expira = ? WHERE sid = ?', [this.expiracion(datos), sid])
      .then(() => cb && cb(null))
      .catch((e) => cb && cb(e));
  }

  destroy(sid, cb) {
    db.query('DELETE FROM sesion WHERE sid = ?', [sid])
      .then(() => cb && cb(null))
      .catch((e) => cb && cb(e));
  }

  limpiarExpiradas() {
    db.query('DELETE FROM sesion WHERE expira <= NOW()').catch((e) =>
      console.error('[sesion] Error al limpiar sesiones:', e.message)
    );
  }

  /** Cierra todas las sesiones de un usuario (al desactivarlo o restablecer su contraseña). */
  static async cerrarSesionesDeUsuario(usuarioId, excepto = null) {
    await db.query('DELETE FROM sesion WHERE usuario_id = ? AND sid <> ?', [usuarioId, excepto || '']);
  }
}

module.exports = SesionStore;
