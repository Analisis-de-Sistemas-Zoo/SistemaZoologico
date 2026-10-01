/**
 * Autenticación: inicio y cierre de sesión, datos del usuario actual y cambio
 * de contraseña. Implementa el bloqueo temporal tras varios intentos fallidos.
 */
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const AppError = require('../../utils/AppError');
const { ok } = require('../../utils/respuesta');
const bitacora = require('../bitacora/bitacora.service');
const SesionStore = require('../sesion-store');
const { permisosDeRol, menuDeRol } = require('../acceso');
const { POLITICA } = require('./politica');

// Hash ficticio: se compara aunque el usuario no exista para que el tiempo de
// respuesta no revele qué usuarios existen.
const HASH_FICTICIO = bcrypt.hashSync('usuario-inexistente', 10);

const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos.';

async function login(req, res) {
  const identificador = String(req.body.usuario || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const usuario = await db.queryUno(
    `SELECT u.id, u.nombres, u.apellidos, u.usuario, u.password_hash, u.activo,
            u.intentos_fallidos, u.bloqueado_hasta,
            (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS bloqueado,
            CEIL(TIMESTAMPDIFF(SECOND, NOW(), u.bloqueado_hasta) / 60) AS minutos_restantes,
            r.codigo AS rol, r.nombre AS rol_nombre
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.usuario = ? OR u.correo = ?`,
    [identificador, identificador]
  );

  if (!usuario) {
    await bcrypt.compare(password, HASH_FICTICIO);
    await bitacora.registrar(req, {
      modulo: 'auth',
      accion: bitacora.ACCIONES.LOGIN_FALLIDO,
      detalle: { usuario: identificador.slice(0, 60), motivo: 'Usuario inexistente' },
    });
    throw new AppError(401, MSG_CREDENCIALES);
  }

  if (usuario.bloqueado) {
    throw new AppError(
      423,
      `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${usuario.minutos_restantes} minuto(s).`
    );
  }

  const valida = await bcrypt.compare(password, usuario.password_hash);

  if (!valida) {
    const intentos = usuario.intentos_fallidos + 1;
    const seBloquea = intentos >= POLITICA.INTENTOS_MAXIMOS;

    await db.query(
      `UPDATE usuario
          SET intentos_fallidos = ?,
              bloqueado_hasta = IF(?, NOW() + INTERVAL ? MINUTE, bloqueado_hasta)
        WHERE id = ?`,
      [seBloquea ? 0 : intentos, seBloquea, POLITICA.MINUTOS_BLOQUEO, usuario.id]
    );
    await bitacora.registrar(req, {
      modulo: 'auth',
      accion: seBloquea ? bitacora.ACCIONES.BLOQUEO : bitacora.ACCIONES.LOGIN_FALLIDO,
      tabla: 'usuario',
      registroId: usuario.id,
      usuarioId: usuario.id,
      detalle: { intento: intentos },
    });

    if (seBloquea) {
      throw new AppError(
        423,
        `Cuenta bloqueada por ${POLITICA.MINUTOS_BLOQUEO} minutos tras ${POLITICA.INTENTOS_MAXIMOS} intentos fallidos.`
      );
    }
    const restantes = POLITICA.INTENTOS_MAXIMOS - intentos;
    throw new AppError(401, `${MSG_CREDENCIALES} Te quedan ${restantes} intento(s).`);
  }

  if (!usuario.activo) {
    throw new AppError(403, 'Tu usuario está inactivo. Contacta al administrador.');
  }

  await db.query(
    'UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id = ?',
    [usuario.id]
  );

  // Nueva sesión para evitar la fijación de sesión.
  await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
  req.session.usuario = {
    id: usuario.id,
    usuario: usuario.usuario,
    nombre: `${usuario.nombres} ${usuario.apellidos}`,
    rol: usuario.rol,
    rolNombre: usuario.rol_nombre,
  };
  await new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));

  await bitacora.registrar(req, {
    modulo: 'auth',
    accion: bitacora.ACCIONES.LOGIN,
    tabla: 'usuario',
    registroId: usuario.id,
  });

  return ok(res, { usuario: req.session.usuario, redirigir: '/app/dashboard.html' }, `Bienvenido, ${usuario.nombres}.`);
}

async function logout(req, res) {
  if (req.session?.usuario) {
    await bitacora.registrar(req, { modulo: 'auth', accion: bitacora.ACCIONES.LOGOUT });
  }
  await new Promise((resolve) => req.session.destroy(() => resolve()));
  res.clearCookie('zoo.sid');
  return ok(res, null, 'Sesión cerrada.');
}

/** Datos del usuario en sesión, sus permisos y su menú. */
async function yo(req, res) {
  const { id, rol } = req.session.usuario;
  const datos = await db.queryUno(
    `SELECT u.id, u.usuario, u.nombres, u.apellidos, u.correo, u.ultimo_acceso,
            r.codigo AS rol, r.nombre AS rol_nombre
       FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = ?`,
    [id]
  );
  return ok(res, {
    usuario: {
      id: datos.id,
      usuario: datos.usuario,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      nombre: `${datos.nombres} ${datos.apellidos}`,
      correo: datos.correo,
      rol: datos.rol,
      rolNombre: datos.rol_nombre,
      ultimoAcceso: datos.ultimo_acceso,
    },
    permisos: permisosDeRol(rol),
    menu: menuDeRol(rol),
  });
}

async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body;
  const { id } = req.session.usuario;

  const fila = await db.queryUno('SELECT password_hash FROM usuario WHERE id = ?', [id]);
  if (!(await bcrypt.compare(String(actual || ''), fila.password_hash))) {
    throw AppError.validacion([{ campo: 'actual', mensaje: 'La contraseña actual no es correcta.' }]);
  }
  if (await bcrypt.compare(nueva, fila.password_hash)) {
    throw AppError.validacion([{ campo: 'nueva', mensaje: 'La nueva contraseña debe ser distinta de la actual.' }]);
  }

  const hash = await bcrypt.hash(nueva, 10);
  await db.query('UPDATE usuario SET password_hash = ? WHERE id = ?', [hash, id]);
  await SesionStore.cerrarSesionesDeUsuario(id, req.sessionID);
  await bitacora.registrar(req, {
    modulo: 'auth',
    accion: bitacora.ACCIONES.CAMBIO_PASSWORD,
    tabla: 'usuario',
    registroId: id,
  });

  return ok(res, null, 'Contraseña actualizada. Se cerraron tus otras sesiones abiertas.');
}

module.exports = { login, logout, yo, cambiarPassword };
