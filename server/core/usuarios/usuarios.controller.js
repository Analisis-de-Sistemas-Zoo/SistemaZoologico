/**
 * Controlador de usuarios (solo administrador).
 * Recibe la petición, valida reglas de negocio, llama al modelo y responde.
 */
const bcrypt = require('bcryptjs');
const modelo = require('./usuarios.model');
const db = require('../../config/db');
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

/** Valida el rol y, si es veterinario, sus datos profesionales. Devuelve el rol. */
async function validarRol(datos, usuarioId = 0) {
  const rol = await modelo.existeRol(datos.rol_id);
  if (!rol) throw AppError.validacion([{ campo: 'rol_id', mensaje: 'El rol seleccionado no existe.' }]);
  if (rol.codigo === 'veterinario') {
    if (!datos.num_colegiado) {
      throw AppError.validacion([{ campo: 'num_colegiado', mensaje: 'El número de colegiado es obligatorio para veterinarios.' }]);
    }
    if (await modelo.colegiadoEnUso(datos.num_colegiado, usuarioId)) {
      throw AppError.validacion([{ campo: 'num_colegiado', mensaje: 'Ese número de colegiado ya está registrado.' }]);
    }
  }
  return rol;
}

const datosVeterinario = (d) => ({ num_colegiado: d.num_colegiado, especialidad: d.especialidad });

async function crear(req, res) {
  const datos = datosValidos(req);
  const rol = await validarRol(datos);
  const password_hash = await bcrypt.hash(datos.password, 10);

  const id = await db.transaccion(async (conn) => {
    const nuevoId = await modelo.crear({ ...datos, password_hash }, conn);
    if (rol.codigo === 'veterinario') await modelo.guardarVeterinario(nuevoId, datosVeterinario(datos), conn);
    return nuevoId;
  });

  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CREAR,
    tabla: 'usuario',
    registroId: id,
    detalle: { usuario: datos.usuario, rol: rol.codigo, ...(rol.codigo === 'veterinario' ? datosVeterinario(datos) : {}) },
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
  const rol = await validarRol(datos, id);

  await db.transaccion(async (conn) => {
    await modelo.actualizar(id, datos, conn);
    // Si deja de ser veterinario se conservan sus datos, porque sus dietas y consultas los referencian.
    if (rol.codigo === 'veterinario') await modelo.guardarVeterinario(id, datosVeterinario(datos), conn);
  });

  const { password, ...sinPassword } = datos;
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'usuario',
    registroId: id,
    detalle: { antes: { usuario: actual.usuario, rol: actual.rol, num_colegiado: actual.num_colegiado }, despues: sinPassword },
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
