/**
 * Controlador de tipos de entrada y promociones.
 * EJEMPLO COMPLETO: ya funciona de punta a punta (incluye lo que muestra el portal).
 */
const { tipos, promociones } = require('./catalogo.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'entradas';

const registrar = (req, accion, tabla, registroId, detalle) =>
  bitacora.registrar(req, { modulo: MODULO, accion, tabla, registroId, detalle });

async function exigir(promesa, mensaje) {
  const r = await promesa;
  if (!r) throw AppError.noEncontrado(mensaje);
  return r;
}

// ============================================================ Tipos de entrada
const tipo = {
  listar: async (req, res) => ok(res, await tipos.listar(req.query)),

  async crear(req, res) {
    const datos = datosValidos(req);
    const id = await tipos.crear(datos);
    await registrar(req, bitacora.ACCIONES.CREAR, 'tipo_entrada', id, datos);
    return creado(res, { id }, 'Tipo de entrada registrado.');
  },

  async actualizar(req, res) {
    const id = Number(req.params.id);
    const antes = await exigir(tipos.obtener(id), 'El tipo de entrada no existe.');
    const datos = datosValidos(req);
    await tipos.actualizar(id, datos);
    // El cambio de precio queda auditado; las ventas anteriores conservan su precio en detalle_compra.
    await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'tipo_entrada', id, { antes: { nombre: antes.nombre, precio: antes.precio }, despues: datos });
    return ok(res, null, 'Tipo de entrada actualizado.');
  },

  async cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { activo } = datosValidos(req);
    await exigir(tipos.obtener(id), 'El tipo de entrada no existe.');
    await tipos.cambiarEstado(id, activo);
    await registrar(req, activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, 'tipo_entrada', id);
    return ok(res, null, activo ? 'Tipo de entrada activado.' : 'Tipo de entrada desactivado.');
  },
};

// ================================================================ Promociones
async function validarPromocion(datos) {
  const errores = [];
  if (datos.fecha_fin < datos.fecha_inicio) errores.push({ campo: 'fecha_fin', mensaje: 'Debe ser igual o posterior a la fecha de inicio.' });
  if (datos.tipo_entrada_id && !(await tipos.obtener(datos.tipo_entrada_id))) {
    errores.push({ campo: 'tipo_entrada_id', mensaje: 'El tipo de entrada no existe.' });
  }
  if (errores.length) throw AppError.validacion(errores);
  if (datos.codigo) datos.codigo = datos.codigo.toUpperCase();
  return datos;
}

const promocion = {
  listar: async (req, res) => ok(res, await promociones.listar(req.query)),

  async crear(req, res) {
    const datos = await validarPromocion(datosValidos(req));
    const id = await promociones.crear(datos);
    await registrar(req, bitacora.ACCIONES.CREAR, 'promocion', id, datos);
    return creado(res, { id }, 'Promoción registrada.');
  },

  async actualizar(req, res) {
    const id = Number(req.params.id);
    const antes = await exigir(promociones.obtener(id), 'La promoción no existe.');
    const datos = await validarPromocion(datosValidos(req));
    await promociones.actualizar(id, datos);
    await registrar(req, bitacora.ACCIONES.ACTUALIZAR, 'promocion', id, {
      antes: { nombre: antes.nombre, descuento: antes.descuento_porcentaje, fin: antes.fecha_fin }, despues: datos,
    });
    return ok(res, null, 'Promoción actualizada.');
  },

  async cambiarEstado(req, res) {
    const id = Number(req.params.id);
    const { activo } = datosValidos(req);
    await exigir(promociones.obtener(id), 'La promoción no existe.');
    await promociones.cambiarEstado(id, activo);
    await registrar(req, activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, 'promocion', id);
    return ok(res, null, activo ? 'Promoción activada.' : 'Promoción desactivada.');
  },
};

// ===================================================================== Portal
const publico = {
  tipos: async (_req, res) => ok(res, await tipos.listar({ activo: 1 })),
  promociones: async (_req, res) => ok(res, await promociones.publicas()),
};

module.exports = { tipo, promocion, publico };
