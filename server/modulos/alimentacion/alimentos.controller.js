/**
 * Controlador de alimentos (catálogo, existencia, alertas e historial).
 */
const alimentos = require('./alimentos.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'alimentacion';

async function exigirAlimento(id) {
  const alimento = await alimentos.obtener(id);
  if (!alimento) throw AppError.noEncontrado('El alimento no existe.');
  return alimento;
}

async function validarNombre(nombre, id = 0) {
  if (await alimentos.buscarPorNombre(nombre, id)) {
    throw AppError.validacion([{ campo: 'nombre', mensaje: 'Ya existe un alimento con ese nombre.' }]);
  }
}

async function listar(req, res) {
  return ok(res, await alimentos.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirAlimento(req.params.id));
}

async function alertas(_req, res) {
  return ok(res, await alimentos.alertas());
}

async function crear(req, res) {
  const datos = datosValidos(req);
  await validarNombre(datos.nombre);
  const id = await alimentos.crear(datos);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'alimento', registroId: id,
    detalle: { nombre: datos.nombre, categoria: datos.categoria, unidad: datos.unidad_medida },
  });
  return creado(res, { id }, 'Alimento registrado.');
}

async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirAlimento(id);
  const datos = datosValidos(req);
  await validarNombre(datos.nombre, id);
  if (datos.unidad_medida !== antes.unidad_medida && (await alimentos.tieneLotes(id))) {
    throw AppError.validacion([{ campo: 'unidad_medida', mensaje: 'No se puede cambiar la unidad: el alimento ya tiene lotes registrados.' }]);
  }
  await alimentos.actualizar(id, datos);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.ACTUALIZAR, tabla: 'alimento', registroId: id,
    detalle: {
      antes: { nombre: antes.nombre, stock_minimo: antes.stock_minimo, dias_aviso_vencimiento: antes.dias_aviso_vencimiento },
      despues: { nombre: datos.nombre, stock_minimo: datos.stock_minimo, dias_aviso_vencimiento: datos.dias_aviso_vencimiento },
    },
  });
  return ok(res, null, 'Alimento actualizado.');
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  const { activo } = datosValidos(req);
  const alimento = await exigirAlimento(id);
  if (!activo && alimento.dietas_activas > 0) {
    throw AppError.conflicto(
      `No se puede desactivar: está en ${alimento.dietas_activas} ${alimento.dietas_activas === 1 ? 'dieta activa' : 'dietas activas'}. Pide al veterinario que las cambie primero.`
    );
  }
  await alimentos.cambiarEstado(id, activo);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR, tabla: 'alimento', registroId: id,
  });
  return ok(res, null, activo ? 'Alimento activado.' : 'Alimento desactivado.');
}

async function movimientos(req, res) {
  const id = Number(req.params.id);
  await exigirAlimento(id);
  return ok(res, await alimentos.movimientos(id, req.query));
}

module.exports = { listar, obtener, alertas, crear, actualizar, cambiarEstado, movimientos };
