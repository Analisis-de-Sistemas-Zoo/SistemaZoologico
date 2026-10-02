/**
 * Controlador de proveedores de alimentos.
 * Las compras de cada proveedor se consultan con GET /lotes?proveedor_id=.
 */
const proveedores = require('./proveedores.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'alimentacion';

async function exigirProveedor(id) {
  const proveedor = await proveedores.obtener(id);
  if (!proveedor) throw AppError.noEncontrado('El proveedor no existe.');
  return proveedor;
}

async function validarUnicos(d, id = 0) {
  const errores = [];
  if (await proveedores.duplicado('nombre', d.nombre, id)) errores.push({ campo: 'nombre', mensaje: 'Ya existe un proveedor con ese nombre.' });
  if (d.nit && (await proveedores.duplicado('nit', d.nit, id))) errores.push({ campo: 'nit', mensaje: 'Ya existe un proveedor con ese NIT.' });
  if (errores.length) throw AppError.validacion(errores);
}

async function listar(req, res) {
  return ok(res, await proveedores.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirProveedor(req.params.id));
}

async function crear(req, res) {
  const d = datosValidos(req);
  await validarUnicos(d);
  const id = await proveedores.crear(d);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'proveedor', registroId: id, detalle: { nombre: d.nombre, nit: d.nit },
  });
  return creado(res, { id }, 'Proveedor registrado.');
}

async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirProveedor(id);
  const d = datosValidos(req);
  await validarUnicos(d, id);
  await proveedores.actualizar(id, d);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.ACTUALIZAR, tabla: 'proveedor', registroId: id,
    detalle: { antes: { nombre: antes.nombre, nit: antes.nit, telefono: antes.telefono }, despues: { nombre: d.nombre, nit: d.nit, telefono: d.telefono } },
  });
  return ok(res, null, 'Proveedor actualizado.');
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  const { activo } = datosValidos(req);
  await exigirProveedor(id);
  await proveedores.cambiarEstado(id, activo);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, tabla: 'proveedor', registroId: id,
  });
  return ok(res, null, activo ? 'Proveedor activado.' : 'Proveedor desactivado.');
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
