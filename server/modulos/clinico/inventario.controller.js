/**
 * Controlador del inventario clínico.
 * EJEMPLO COMPLETO: listar, crear, editar y activar/desactivar ya funcionan.
 * Pendiente: movimientos (entradas y mermas) e historial.
 */
const inventario = require('./inventario.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const { pendiente } = require('../../utils/pendiente');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'clinico';

async function exigirInsumo(id) {
  const insumo = await inventario.obtener(id);
  if (!insumo) throw AppError.noEncontrado('El insumo clínico no existe.');
  return insumo;
}

/** Los datos de vacuna solo se guardan cuando el tipo es vacuna (lo exige un CHECK de la BD). */
function normalizar(datos) {
  if (datos.tipo !== 'vacuna') {
    datos.enfermedad_previene = null;
    datos.intervalo_refuerzo_dias = null;
  }
  return datos;
}

async function listar(req, res) {
  return ok(res, await inventario.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirInsumo(req.params.id));
}

async function crear(req, res) {
  const datos = normalizar(datosValidos(req));
  const id = await inventario.crear(datos);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CREAR,
    tabla: 'insumo_clinico',
    registroId: id,
    detalle: { tipo: datos.tipo, nombre: datos.nombre, stock_inicial: datos.stock_actual ?? 0 },
  });
  return creado(res, { id }, 'Insumo clínico registrado.');
}

async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirInsumo(id);
  const datos = normalizar(datosValidos(req));
  await inventario.actualizar(id, datos);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'insumo_clinico',
    registroId: id,
    detalle: { antes: { nombre: antes.nombre, stock_minimo: antes.stock_minimo }, despues: datos },
  });
  return ok(res, null, 'Insumo clínico actualizado.');
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  const { activo } = datosValidos(req);
  await exigirInsumo(id);
  await inventario.cambiarEstado(id, activo);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR,
    tabla: 'insumo_clinico',
    registroId: id,
  });
  return ok(res, null, activo ? 'Insumo activado.' : 'Insumo desactivado.');
}

/**
 * GET /inventario/:id/movimientos
 * TODO (Daniela): historial del insumo (movimiento_clinico), del más reciente al más antiguo.
 * Ver docs/api/clinico.md → "Historial de movimientos".
 */
async function movimientos(_req, _res) {
  pendiente('Historial de movimientos del insumo clínico');
}

/**
 * POST /inventario/:id/movimientos  { tipo: 'entrada'|'merma', cantidad, numero_lote, fecha_vencimiento, motivo }
 * TODO (Daniela): en una transacción
 *   1. Insertar en movimiento_clinico con usuario_id = req.session.usuario.id
 *   2. Sumar (entrada) o restar (merma) en insumo_clinico.stock_actual
 *   3. Si una merma deja la existencia negativa, responder 409
 *   4. Bitácora
 */
async function registrarMovimiento(_req, _res) {
  pendiente('Registrar entrada o merma de insumos clínicos');
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, movimientos, registrarMovimiento };
