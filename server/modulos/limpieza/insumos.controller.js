/**
 * Controlador de insumos de limpieza.
 * EJEMPLO COMPLETO: listar, crear, editar y activar/desactivar ya funcionan.
 * Pendiente: movimientos (entradas y mermas) e historial.
 */
const insumos = require('./insumos.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const { pendiente } = require('../../utils/pendiente');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'limpieza';

async function exigirInsumo(id) {
  const insumo = await insumos.obtener(id);
  if (!insumo) throw AppError.noEncontrado('El insumo no existe.');
  return insumo;
}

async function listar(req, res) {
  return ok(res, await insumos.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirInsumo(req.params.id));
}

async function crear(req, res) {
  const datos = datosValidos(req);
  const id = await insumos.crear(datos);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CREAR,
    tabla: 'insumo_limpieza',
    registroId: id,
    detalle: { nombre: datos.nombre, stock_inicial: datos.stock_actual ?? 0 },
  });
  return creado(res, { id }, 'Insumo registrado.');
}

async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirInsumo(id);
  const datos = datosValidos(req);
  await insumos.actualizar(id, datos);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'insumo_limpieza',
    registroId: id,
    detalle: { antes: { nombre: antes.nombre, stock_minimo: antes.stock_minimo }, despues: datos },
  });
  return ok(res, null, 'Insumo actualizado.');
}

async function cambiarEstado(req, res) {
  const id = Number(req.params.id);
  const { activo } = datosValidos(req);
  await exigirInsumo(id);
  await insumos.cambiarEstado(id, activo);
  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: activo ? bitacora.ACCIONES.ACTIVAR : bitacora.ACCIONES.DESACTIVAR,
    tabla: 'insumo_limpieza',
    registroId: id,
  });
  return ok(res, null, activo ? 'Insumo activado.' : 'Insumo desactivado.');
}

/**
 * GET /api/limpieza/insumos/:id/movimientos
 * TODO (Alan): devolver el historial del insumo, del más reciente al más antiguo.
 * Ver docs/api/limpieza.md → "Historial de movimientos".
 */
async function movimientos(_req, _res) {
  pendiente('Historial de movimientos del insumo');
}

/**
 * POST /api/limpieza/insumos/:id/movimientos   { tipo: 'entrada'|'merma', cantidad, motivo }
 * TODO (Alan): en una transacción (db.transaccion)
 *   1. Insertar en movimiento_insumo_limpieza con usuario_id = req.session.usuario.id
 *   2. Sumar (entrada) o restar (merma) en insumo_limpieza.stock_actual
 *   3. Si una merma deja el stock negativo, responder 409 (la BD también lo impide con un CHECK)
 *   4. Registrar en la bitácora
 */
async function registrarMovimiento(_req, _res) {
  pendiente('Registrar entrada o merma de insumos');
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, movimientos, registrarMovimiento };
