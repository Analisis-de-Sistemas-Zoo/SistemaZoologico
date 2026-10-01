/**
 * Controlador de usuarios (solo administrador).
 * Recibe la petición, valida reglas de negocio, llama al modelo y responde.
 */
const bcrypt = require('bcryptjs');
const modelo = require('./usuarios.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../bitacora/bitacora.service');
const SesionStore = require('../sesion-store');

const MODULO = 'usuarios';

async function listar(req, res) {
  const { buscar, rol_id: rolId, activo } = req.query;
  return ok(res, await modelo.listar({ buscar, rolId, activo }));
}

async function obtener(req, res) {
  const usuario = await modelo.obtener(req.params.id);
  if (!usuario) throw AppError.noEncontrado('El usuario no existe.');
  return ok(res, usuario);
}

async function roles(_req, res) {
  return ok(res, await modelo.listarRoles());
}

async function crear(req, res) {
  const datos = datosValidos(req);
  if (!(await modelo.existeRol(datos.rol_id))) {
    throw AppError.validacion([{ campo: 'rol_id', mensaje: 'El rol seleccionado no existe.' }]);
  }
  const password_hash = await bcrypt.hash(datos.password, 10);
  const id = await modelo.crear({ ...datos, password_hash });

  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CREAR,
    tabla: 'usuario',
    registroId: id,
    detalle: { usuario: datos.usuario, rol_id: datos.rol_id },
  });
  return creado(res, { id }, 'Usuario creado correctamente.');
}

async function actualizar(req, res) {
  const id = Number(req.params.id);
  const datos = datosValidos(req);
  const actual = await modelo.obtener(id);
  if (!actual) throw AppError.noEncontrado('El usuario no existe.');

  if (id === req.session.usuario.id && Number(datos.rol_id) !== actual.rol_id) {
    throw AppError.validacion([{ campo: 'rol_id', mensaje: 'No puedes cambiar tu propio rol.' }]);
  }
  if (!(await modelo.existeRol(datos.rol_id))) {
    throw AppError.validacion([{ campo: 'rol_id', mensaje: 'El rol seleccionado no existe.' }]);
  }

  await modelo.actualizar(id, datos);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'usuario',
    registroId: id,
    detalle: { antes: { usuario: actual.usuario, rol_id: actual.rol_id }, despues: datos },
  });
  return ok(res, null, 'Usuario actualizado correctamente.');
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  const { activo } = datosValidos(req);
  if (id === req.session.usuario.id) {
    throw new AppError(400, 'No puedes desactivar tu propio usuario.');
  }
  const actual = await modelo.obtener(id);
  if (!actual) throw AppError.noEncontrado('El usuario no existe.');

  await modelo.cambiarEstado(id, activo);
  if (!activo) await SesionStore.cerrarSesionesDeUsuario(id);

  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR,
    tabla: 'usuario',
    registroId: id,
  });
  return ok(res, null, activo ? 'Usuario activado.' : 'Usuario desactivado y sus sesiones cerradas.');
}

async function restablecerPassword(req, res) {
  const id = Number(req.params.id);
  const { password } = datosValidos(req);
  const actual = await modelo.obtener(id);
  if (!actual) throw AppError.noEncontrado('El usuario no existe.');

  await modelo.cambiarPassword(id, await bcrypt.hash(password, 10));
  await SesionStore.cerrarSesionesDeUsuario(id, req.sessionID);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CAMBIO_PASSWORD,
    tabla: 'usuario',
    registroId: id,
    detalle: 'Contraseña restablecida por el administrador',
  });
  return ok(res, null, 'Contraseña restablecida. El usuario deberá iniciar sesión de nuevo.');
}

module.exports = { listar, obtener, roles, crear, actualizar, cambiarEstado, restablecerPassword };
