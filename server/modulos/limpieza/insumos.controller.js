/**
 * Controlador de insumos de limpieza.
 * Listar, crear, editar y activar/desactivar ya funcionaban; aquí también el
 * historial de movimientos y el registro de entradas y mermas.
 */
const db = require('../../config/db');
const insumos = require('./insumos.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'limpieza';

/** El stock tiene dos decimales en la BD. */
const redondear2 = (valor) => Math.round(Number(valor) * 100) / 100;

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
 * Historial del insumo, del más reciente al más antiguo.
 * Ver docs/api/limpieza.md → "Historial de movimientos".
 */
async function movimientos(req, res) {
  const id = Number(req.params.id);
  await exigirInsumo(id);
  return ok(res, await insumos.movimientos(id));
}

/**
 * POST /api/limpieza/insumos/:id/movimientos   { tipo: 'entrada'|'merma', cantidad, motivo }
 * En una transacción:
 *   1. Insertar en movimiento_insumo_limpieza con usuario_id = req.session.usuario.id
 *   2. Sumar (entrada) o restar (merma) en insumo_limpieza.stock_actual
 *   3. Si una merma deja el stock negativo, responder 409 (la BD también lo impide con un CHECK)
 *   4. Registrar en la bitácora
 */
async function registrarMovimiento(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirInsumo(id);
  const { tipo, cantidad, motivo } = datosValidos(req);
  const valor = redondear2(cantidad);

  await db.transaccion(async (conn) => {
    await insumos.crearMovimiento({ insumo_id: id, tipo, cantidad: valor, motivo, usuario_id: req.session.usuario.id }, conn);
    if (tipo === 'entrada') {
      await insumos.sumarStock(id, valor, conn);
    } else {
      const resta = await insumos.restarStock(id, valor, conn);
      if (!resta.affectedRows) {
        throw AppError.conflicto(`La merma dejaría el stock en negativo (hay ${antes.stock_actual}).`);
      }
    }
  });

  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.ACTUALIZAR,
    tabla: 'insumo_limpieza',
    registroId: id,
    detalle: { movimiento: { tipo, cantidad: valor, motivo }, stock: { antes: Number(antes.stock_actual) } },
  });
  return creado(res, { id, tipo, cantidad: valor }, tipo === 'entrada' ? 'Entrada registrada.' : 'Merma registrada.');
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, movimientos, registrarMovimiento };
