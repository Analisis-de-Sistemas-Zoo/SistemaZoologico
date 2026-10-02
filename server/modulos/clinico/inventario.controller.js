/**
 * Controlador del inventario clínico.
 * Listar, crear, editar y activar/desactivar, más el historial de movimientos
 * y el registro de entradas y mermas.
 * Contrato: docs/api/clinico.md
 */
const db = require('../../config/db');
const inventario = require('./inventario.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'clinico';

/** La existencia tiene dos decimales en la BD. */
const redondear2 = (valor) => Math.round(Number(valor) * 100) / 100;

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
 * GET /inventario/:id/movimientos — historial del insumo, del más reciente al
 * más antiguo. `animal` solo viene en las salidas (la aplicación que la generó).
 * Ver docs/api/clinico.md → "Historial de movimientos".
 */
async function movimientos(req, res) {
  const id = Number(req.params.id);
  await exigirInsumo(id);
  return ok(res, await inventario.movimientos(id));
}

/**
 * POST /inventario/:id/movimientos  { tipo: 'entrada'|'merma', cantidad, numero_lote, fecha_vencimiento, motivo }
 * En una transacción:
 *   1. Insertar en movimiento_clinico con usuario_id = req.session.usuario.id
 *   2. Sumar (entrada) o restar (merma) en insumo_clinico.stock_actual
 *   3. Si una merma deja la existencia negativa, responder 409 (la BD también lo impide con un CHECK)
 *   4. Bitácora
 */
async function registrarMovimiento(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirInsumo(id);
  const { tipo, cantidad, numero_lote, fecha_vencimiento, motivo } = datosValidos(req);
  const valor = redondear2(cantidad);
  // El lote y el vencimiento son datos del producto recibido: en una merma no aplican.
  const esEntrada = tipo === 'entrada';

  const idMovimiento = await db.transaccion(async (conn) => {
    const movimiento = await inventario.crearMovimiento(
      {
        insumo_clinico_id: id,
        tipo,
        cantidad: valor,
        numero_lote: esEntrada ? numero_lote : null,
        fecha_vencimiento: esEntrada ? fecha_vencimiento : null,
        motivo,
        usuario_id: req.session.usuario.id,
      },
      conn
    );
    if (esEntrada) {
      await inventario.sumarStock(id, valor, conn);
    } else {
      const resta = await inventario.restarStock(id, valor, conn);
      if (!resta.affectedRows) {
        throw AppError.conflicto(`La merma dejaría la existencia en negativo (hay ${antes.stock_actual}).`);
      }
    }
    return movimiento.insertId;
  });

  await bitacora.registrar(req, {
    modulo: MODULO,
    accion: bitacora.ACCIONES.CREAR,
    tabla: 'movimiento_clinico',
    registroId: idMovimiento,
    detalle: { insumo_clinico_id: id, tipo, cantidad: valor, motivo, stock: { antes: Number(antes.stock_actual) } },
  });
  return creado(res, { id: idMovimiento, tipo, cantidad: valor }, esEntrada ? 'Entrada registrada.' : 'Merma registrada.');
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, movimientos, registrarMovimiento };
