/**
 * Controlador de lotes: entradas por compra, corrección de datos, mermas e historial.
 */
const db = require('../../config/db');
const lotes = require('./lotes.model');
const alimentos = require('./alimentos.model');
const proveedores = require('./proveedores.model');
const AppError = require('../../utils/AppError');
const { ok, creado } = require('../../utils/respuesta');
const { datosValidos } = require('../../middlewares/validar');
const bitacora = require('../../core/bitacora/bitacora.service');

const MODULO = 'alimentacion';

const hoy = () => {
  const d = new Date(Date.now() - 6 * 3600 * 1000); // Guatemala, UTC-6
  return d.toISOString().slice(0, 10);
};

async function exigirLote(id) {
  const lote = await lotes.obtener(id);
  if (!lote) throw AppError.noEncontrado('El lote no existe.');
  return lote;
}

/** Reglas comunes de fechas, número de lote y proveedor activo. */
async function validarDocumento(d, alimentoId, { loteId = 0, proveedorAnterior = null } = {}) {
  const errores = [];
  if (d.fecha_ingreso > hoy()) errores.push({ campo: 'fecha_ingreso', mensaje: 'La fecha de ingreso no puede ser futura.' });
  if (d.fecha_vencimiento && d.fecha_vencimiento < d.fecha_ingreso) {
    errores.push({ campo: 'fecha_vencimiento', mensaje: 'El vencimiento no puede ser anterior al ingreso.' });
  }
  if (await lotes.existeNumero(alimentoId, d.numero_lote, loteId)) {
    errores.push({ campo: 'numero_lote', mensaje: 'Ese número de lote ya está registrado para este alimento.' });
  }
  const proveedor = await proveedores.obtener(d.proveedor_id);
  if (!proveedor) errores.push({ campo: 'proveedor_id', mensaje: 'El proveedor no existe.' });
  else if (!proveedor.activo && proveedor.id !== proveedorAnterior) {
    errores.push({ campo: 'proveedor_id', mensaje: 'El proveedor está inactivo.' });
  }
  if (errores.length) throw AppError.validacion(errores);
}

async function listar(req, res) {
  return ok(res, await lotes.listar(req.query));
}

async function obtener(req, res) {
  return ok(res, await exigirLote(req.params.id));
}

/** POST /lotes — entrada de alimento por compra. */
async function crear(req, res) {
  const d = datosValidos(req);
  const alimento = await alimentos.obtener(d.alimento_id);
  if (!alimento) throw AppError.validacion([{ campo: 'alimento_id', mensaje: 'El alimento no existe.' }]);
  if (!alimento.activo) throw AppError.validacion([{ campo: 'alimento_id', mensaje: 'El alimento está inactivo.' }]);
  await validarDocumento(d, d.alimento_id);
  if (d.fecha_vencimiento && d.fecha_vencimiento < hoy()) {
    throw AppError.validacion([{ campo: 'fecha_vencimiento', mensaje: 'El producto ya está vencido; no se puede ingresar.' }]);
  }

  const usuarioId = req.session.usuario.id;
  const id = await db.transaccion(async (conn) => {
    const nuevo = await lotes.crear(d, usuarioId, conn);
    await bitacora.registrar(req, {
      modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'lote_alimento', registroId: nuevo,
      detalle: { alimento: alimento.nombre, lote: d.numero_lote, cantidad: d.cantidad, unidad: alimento.unidad_medida, factura: d.numero_factura },
    }, conn);
    return nuevo;
  });
  return creado(res, { id }, `Entrada registrada: ${d.cantidad} ${alimento.unidad_medida} de ${alimento.nombre}.`);
}

/** PUT /lotes/:id — corrige los datos del documento (no el alimento ni las cantidades). */
async function actualizar(req, res) {
  const id = Number(req.params.id);
  const antes = await exigirLote(id);
  const d = datosValidos(req);
  await validarDocumento(d, antes.alimento_id, { loteId: id, proveedorAnterior: antes.proveedor_id });
  await lotes.actualizar(id, d);
  await bitacora.registrar(req, {
    modulo: MODULO, accion: bitacora.ACCIONES.ACTUALIZAR, tabla: 'lote_alimento', registroId: id,
    detalle: {
      antes: { numero_lote: antes.numero_lote, factura: antes.numero_factura, vencimiento: antes.fecha_vencimiento, costo: antes.costo_unitario },
      despues: { numero_lote: d.numero_lote, factura: d.numero_factura, vencimiento: d.fecha_vencimiento, costo: d.costo_unitario },
    },
  });
  return ok(res, null, 'Datos del lote actualizados.');
}

/** POST /lotes/:id/mermas { cantidad, motivo } — pérdida, daño o baja por vencimiento. */
async function registrarMerma(req, res) {
  const id = Number(req.params.id);
  const { cantidad, motivo } = datosValidos(req);
  const usuarioId = req.session.usuario.id;

  const resultado = await db.transaccion(async (conn) => {
    const lote = await lotes.bloquear(conn, id);
    if (!lote) throw AppError.noEncontrado('El lote no existe.');
    if (cantidad > Number(lote.cantidad_disponible) + 1e-9) {
      throw AppError.validacion([{ campo: 'cantidad', mensaje: `El lote solo tiene ${Number(lote.cantidad_disponible)} disponible.` }]);
    }
    const movimientoId = await lotes.registrarMerma(conn, id, cantidad, motivo, usuarioId);
    await bitacora.registrar(req, {
      modulo: MODULO, accion: bitacora.ACCIONES.CREAR, tabla: 'movimiento_alimento', registroId: movimientoId,
      detalle: { tipo: 'merma', lote_id: id, cantidad, motivo },
    }, conn);
    return { id: movimientoId, disponible: Math.round((Number(lote.cantidad_disponible) - cantidad) * 1000) / 1000 };
  });
  return creado(res, resultado, 'Merma registrada.');
}

async function movimientos(req, res) {
  const id = Number(req.params.id);
  await exigirLote(id);
  return ok(res, await lotes.movimientos(id));
}

module.exports = { listar, obtener, crear, actualizar, registrarMerma, movimientos };
